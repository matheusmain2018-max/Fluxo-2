import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap, 
  Connection, 
  Edge, 
  Node,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Panel,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OperationType, ChecklistItem, UserProfile, Workspace } from '../types';
import { handleFirestoreError } from '../utils';
import { 
  ChevronLeft, 
  Plus, 
  Share2, 
  Trash2, 
  MousePointer2, 
  Type, 
  X, 
  Maximize, 
  AlertTriangle, 
  ListTodo, 
  CheckSquare, 
  Square, 
  Palette, 
  User, 
  Users,
  Circle,
  RectangleHorizontal,
  Diamond,
  FileText
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { motion } from 'motion/react';
import CustomEdge from './CustomEdge';
import CustomNode from './CustomNode';
import GroupNode from './GroupNode';

const edgeTypes = {
  custom: CustomEdge,
};

const nodeTypes = {
  custom: CustomNode,
  group: GroupNode,
};

interface FlowEditorProps {
  workspaceId: string;
  onBack: () => void;
}

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorContent {...props} />
    </ReactFlowProvider>
  );
}

function FlowEditorContent({ workspaceId, onBack }: FlowEditorProps) {
  const { setCenter, getNodes, fitView, screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const [workspaceName, setWorkspaceName] = useState('');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, UserProfile>>({});
  const [isSharing, setIsSharing] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync Nodes
  useEffect(() => {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNodes: Node[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const node = { 
          id: docSnapshot.id, 
          ...data,
          type: data.type || 'custom',
          data: {
            ...data.data,
            profiles: profilesMap,
            onToggleChecklistItem: (itemId: string) => toggleChecklistItem(docSnapshot.id, data.data?.checklist || [], itemId),
            onToggleCollapse: () => toggleGroupCollapse(docSnapshot.id, data.data?.isCollapsed || false)
          }
        } as Node;

        // Handle visibility and reference integrity for nodes in groups
        if (node.parentId) {
          const exists = snapshot.docs.some(d => d.id === node.parentId);
          if (!exists) {
            // Broken reference! Fix local state to avoid crash
            delete node.parentId;
            delete node.extent;
          } else {
            const parentDoc = snapshot.docs.find(d => d.id === node.parentId);
            if (parentDoc && parentDoc.data().data?.isCollapsed) {
              node.hidden = true;
            }
          }
        }

        newNodes.push(node);
      });
      setNodes(newNodes);
      setError(null);
    }, (err) => {
      if (err.message.includes('Quota limit exceeded') || err.message.includes('Quota exceeded')) {
        setError('Limite diário de uso atingido. O editor está em modo offline.');
      } else {
        handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/nodes`);
      }
    });
    return () => unsubscribe();
  }, [workspaceId, profilesMap]);

  // Sync Edges
  useEffect(() => {
    const q = query(collection(db, `workspaces/${workspaceId}/edges`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newEdges: Edge[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        newEdges.push({ 
          id: docSnapshot.id, 
          ...data,
          type: 'custom',
          data: { 
            ...data.data,
            onDelete: (id: string) => deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, id))
          }
        } as Edge);
      });
      setEdges(newEdges);
    }, (err) => {
      if (!err.message.includes('Quota limit exceeded') && !err.message.includes('Quota exceeded')) {
        handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceId}/edges`);
      }
    });
    return () => unsubscribe();
  }, [workspaceId]);

  // Sync Workspace Info and Members
  useEffect(() => {
    const fetchWorkspace = async () => {
      const docRef = doc(db, 'workspaces', workspaceId);
      const unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const workspaceData = docSnap.data() as Workspace;
          setWorkspaceName(workspaceData.name);
          
          if (workspaceData.members && workspaceData.members.length > 0) {
            const memberProfiles: UserProfile[] = [];
            const newProfilesMap: Record<string, UserProfile> = {};
            
            for (const memberId of workspaceData.members) {
              const userSnap = await getDoc(doc(db, 'users', memberId));
              if (userSnap.exists()) {
                const profile = { uid: memberId, ...userSnap.data() } as UserProfile;
                memberProfiles.push(profile);
                newProfilesMap[memberId] = profile;
              }
            }
            setMembers(memberProfiles);
            setProfilesMap(newProfilesMap);
          }
        }
      });
      return unsubscribe;
    };
    const unsubscribePromise = fetchWorkspace();
    return () => {
      unsubscribePromise.then(unsub => unsub?.());
    };
  }, [workspaceId]);

  const deleteNode = useCallback(async (nodeId: string) => {
    try {
      // Find children first
      const children = nodes.filter(n => n.parentId === nodeId);
      for (const child of children) {
        await deleteNode(child.id); // Recursive delete
      }
      await deleteDoc(doc(db, `workspaces/${workspaceId}/nodes`, nodeId));
    } catch (error) {
      console.error('Error deleting node:', nodeId, error);
    }
  }, [nodes, workspaceId]);

  const onNodesChange = useCallback(
    async (changes: NodeChange[]) => {
      // Local state update for immediate feedback
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Sync to Firestore
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, change.id);
          await setDoc(nodeRef, { position: change.position }, { merge: true });
        } else if (change.type === 'remove') {
          await deleteNode(change.id);
        }
      }
    },
    [workspaceId, deleteNode]
  );

  const onEdgesChange = useCallback(
    async (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));

      for (const change of changes) {
        if (change.type === 'remove') {
          await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, change.id));
        }
      }
    },
    [workspaceId]
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      const id = nanoid();
      const newEdge = {
        ...params,
        id,
        type: 'custom',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
      };
      
      await setDoc(doc(db, `workspaces/${workspaceId}/edges`, id), newEdge);
    },
    [workspaceId]
  );

  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('#171717');
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>([]);
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const [editShape, setEditShape] = useState<'rect' | 'rounded' | 'circle' | 'diamond'>('rounded');
  const [editNotes, setEditNotes] = useState('');
  const [editCompleted, setEditCompleted] = useState(false);
  const [editStrikeThrough, setEditStrikeThrough] = useState(true);
  const [newItemText, setNewItemText] = useState('');

  const toggleChecklistItem = async (nodeId: string, checklist: ChecklistItem[], itemId: string) => {
    try {
      const newChecklist = checklist.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, nodeId);
      await updateDoc(nodeRef, {
        'data.checklist': newChecklist
      });
    } catch (error) {
      console.error('Error toggling checklist item:', error);
    }
  };

  const toggleGroupCollapse = async (groupId: string, currentCollapsed: boolean) => {
    try {
      const groupRef = doc(db, `workspaces/${workspaceId}/nodes`, groupId);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) return;
      
      const groupData = groupSnap.data();
      const expandedSize = groupData.data?.expandedSize || { width: 300, height: 200 };
      
      const nextCollapsed = !currentCollapsed;
      
      await updateDoc(groupRef, { 
        'data.isCollapsed': nextCollapsed,
        'style.width': nextCollapsed ? 180 : expandedSize.width,
        'style.height': nextCollapsed ? 60 : expandedSize.height,
        // If expanding, we might want to ensure it doesn't overlap weirdly, but usually React Flow handles position
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `nodes/${groupId}`);
    }
  };

  const COLORS = [
    { name: 'Padrão', value: '#171717' },
    { name: 'Esmeralda', value: '#064e3b' },
    { name: 'Azul', value: '#1e3a8a' },
    { name: 'Vermelho', value: '#7f1d1d' },
    { name: 'Roxo', value: '#4c1d95' },
    { name: 'Âmbar', value: '#78350f' },
  ];

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setEditingNode(node);
      setEditLabel(node.data.label);
      setEditColor(node.data.color || '#171717');
      setEditChecklist(node.data.checklist || []);
      setEditAssignedTo(node.data.assignedTo || null);
      setEditShape(node.data.shape || 'rounded');
      setEditNotes(node.data.notes || '');
      setEditCompleted(node.data.completed || false);
      setEditStrikeThrough(node.data.strikeThrough !== false);
      setNewItemText('');
    },
    []
  );

  const addChecklistItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: nanoid(),
      text: newItemText.trim(),
      completed: false
    };
    setEditChecklist([...editChecklist, newItem]);
    setNewItemText('');
  };

  const removeChecklistItem = (id: string) => {
    setEditChecklist(editChecklist.filter(item => item.id !== id));
  };

  const toggleEditChecklistItem = (id: string) => {
    setEditChecklist(editChecklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const saveNodeChanges = async () => {
    if (!editingNode) return;
    
    console.log('Attempting to save node changes:', { id: editingNode.id, editLabel, editColor });
    
    try {
      const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, editingNode.id);
      
    await updateDoc(nodeRef, {
      'data.label': editLabel,
      'data.color': editColor,
      'data.checklist': editChecklist,
      'data.assignedTo': editAssignedTo,
      'data.shape': editShape,
      'data.notes': editNotes,
      'data.completed': editCompleted,
      'data.strikeThrough': editStrikeThrough,
      'style.backgroundColor': editColor,
      'style.background': editColor
    });
      
      console.log('Update successful');
      setEditingNode(null);
    } catch (error) {
      console.error('Update failed:', error);
      handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}/nodes`);
    }
  };

  const onEdgeDoubleClick = useCallback(
    async (_event: React.MouseEvent, edge: Edge) => {
      if (confirm('Deseja remover esta conexão?')) {
        try {
          await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, edge.id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `workspaces/${workspaceId}/edges`);
        }
      }
    },
    [workspaceId]
  );

  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        await deleteNode(node.id);
      }
    },
    [deleteNode]
  );

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, edge.id));
      }
    },
    [workspaceId]
  );

  const deleteSelected = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedEdges = edges.filter((e) => e.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    if (confirm(`Deseja excluir ${selectedNodes.length} blocos e ${selectedEdges.length} conexões?`)) {
      try {
        for (const node of selectedNodes) {
          await deleteNode(node.id);
        }
        for (const edge of selectedEdges) {
          await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, edge.id));
        }
      } catch (error) {
        console.error('Error deleting selected:', error);
      }
    }
  }, [nodes, edges, workspaceId]);

  const clearBoard = useCallback(async () => {
    if (nodes.length === 0) return;
    if (confirm(`Tem certeza que deseja excluir TODOS os ${nodes.length} blocos e conexões deste ambiente? Esta ação é irreversível.`)) {
      try {
        for (const node of nodes) {
          // No need for recursive delete here as we delete everything anyway
          await deleteDoc(doc(db, `workspaces/${workspaceId}/nodes`, node.id));
        }
        for (const edge of edges) {
          await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, edge.id));
        }
      } catch (error) {
        console.error('Error clearing board:', error);
      }
    }
  }, [nodes, edges, workspaceId]);

  const addNode = useCallback(async () => {
    const id = nanoid();
    // Use the last known mouse position converted to flow coordinates
    // If not available, use center of screen
    const position = screenToFlowPosition({ x: lastMousePos.current.x, y: lastMousePos.current.y });
    
    const newNode = {
      id,
      type: 'custom',
      position,
      data: { 
        label: 'Novo Bloco',
        color: '#171717'
      },
    };
    await setDoc(doc(db, `workspaces/${workspaceId}/nodes`, id), newNode);
  }, [workspaceId, screenToFlowPosition]);

  const duplicateSelected = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    const nodeIdMap: Record<string, string> = {};
    
    // Copy Nodes
    for (const node of selectedNodes) {
      const newId = nanoid();
      nodeIdMap[node.id] = newId;
      
      const newNode = {
        ...node,
        id: newId,
        selected: false,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        data: { ...node.data }
      };
      // Remove functions from data for firestore
      delete (newNode.data as any).onToggleChecklistItem;
      delete (newNode.data as any).onToggleCollapse;
      
      await setDoc(doc(db, `workspaces/${workspaceId}/nodes`, newId), newNode);
    }

    // Copy Edges that connect selected nodes
    const selectedEdges = edges.filter(e => nodeIdMap[e.source] && nodeIdMap[e.target]);
    for (const edge of selectedEdges) {
      const newId = nanoid();
      const newEdge = {
        ...edge,
        id: newId,
        source: nodeIdMap[edge.source],
        target: nodeIdMap[edge.target],
        selected: false
      };
      // Remove functions
      delete (newEdge.data as any).onDelete;
      
      await setDoc(doc(db, `workspaces/${workspaceId}/edges`, newId), newEdge);
    }
  }, [nodes, edges, workspaceId]);

  const groupSelected = useCallback(async () => {
    const selectedNodes = nodes.filter(n => n.selected && n.type !== 'group');
    if (selectedNodes.length < 1) return;

    const groupId = nanoid();
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + (n.width || 200));
      maxY = Math.max(maxY, n.position.y + (n.height || 150));
    });

    const padding = 40;
    const groupNode = {
      id: groupId,
      type: 'group',
      position: { x: minX - padding, y: minY - padding - 40 },
      style: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 + 60 },
      data: { 
        label: 'Nova Etapa', 
        isCollapsed: false,
        expandedSize: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 + 60 }
      }
    };

    // Create group
    await setDoc(doc(db, `workspaces/${workspaceId}/nodes`, groupId), groupNode);

    // Update children parentId and relative positions
    for (const node of selectedNodes) {
      const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, node.id);
      await updateDoc(nodeRef, {
        parentId: groupId,
        extent: 'parent',
        position: {
          x: node.position.x - groupNode.position.x,
          y: (node.position.y - groupNode.position.y) 
        }
      });
    }
  }, [nodes, workspaceId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        groupSelected();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [duplicateSelected, deleteSelected]);

  const handleShare = async () => {
    try {
      const inviteId = nanoid(10);
      await setDoc(doc(db, 'invites', inviteId), {
        workspaceId,
        createdBy: auth.currentUser?.uid,
        createdAt: new Date().toISOString(),
      });
      
      const url = `${window.location.origin}?invite=${inviteId}`;
      setInviteUrl(url);
      setIsSharing(true);
      navigator.clipboard.writeText(url);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invites');
    }
  };

  return (
    <div className="h-full w-full relative bg-neutral-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        edgeTypes={edgeTypes}
        nodeTypes={nodeTypes}
        fitView
        selectionOnDrag
        className="bg-neutral-950"
      >
        <Background color="#333" gap={20} />
        <Controls className="bg-neutral-900 border-white/10 fill-white" />
        <MiniMap 
          style={{ 
            background: '#171717',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            width: 200,
            height: 150
          }} 
          nodeColor="#10b981"
          maskColor="rgba(16, 185, 129, 0.1)"
          maskStrokeColor="#10b981"
          maskStrokeWidth={2}
          pannable
          zoomable
        />
        
        <Panel position="top-left" className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="bg-neutral-900 border border-white/10 p-2 rounded-xl hover:bg-neutral-800 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="bg-neutral-900 border border-white/10 px-4 py-2 rounded-xl">
            <span className="text-sm font-bold text-emerald-500 uppercase tracking-widest">Ambiente</span>
            <h2 className="text-lg font-bold leading-tight">{workspaceName}</h2>
          </div>
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 px-4 py-2 rounded-xl flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </Panel>

        <Panel position="top-right" className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((member) => (
              <div 
                key={member.uid} 
                className="w-10 h-10 rounded-full border-2 border-neutral-950 bg-neutral-900 flex items-center justify-center overflow-hidden"
                title={member.displayName || 'Usuário'}
              >
                {member.photoURL ? (
                  <img src={member.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-5 h-5 text-neutral-500" />
                )}
              </div>
            ))}
            {members.length > 5 && (
              <div className="w-10 h-10 rounded-full border-2 border-neutral-950 bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400">
                +{members.length - 5}
              </div>
            )}
            {members.length === 0 && (
              <div className="w-10 h-10 rounded-full border-2 border-neutral-950 bg-neutral-900 flex items-center justify-center">
                <Users className="w-5 h-5 text-neutral-600" />
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/10" />

          <button
            onClick={addNode}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Adicionar Bloco
          </button>
          
          <button
            onClick={handleShare}
            className="bg-neutral-900 border border-white/10 hover:border-emerald-500/50 py-2 px-4 rounded-xl flex items-center gap-2 transition-all"
          >
            <Share2 className="w-4 h-4 text-emerald-500" />
            Convidar
          </button>
        </Panel>

        <Panel position="bottom-right" className="flex flex-col gap-2 mb-20 mr-2">
          <button
            onClick={() => fitView()}
            className="bg-neutral-900 border border-white/10 p-3 rounded-xl hover:bg-neutral-800 transition-colors shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            title="Ajustar Visualização"
          >
            <Maximize className="w-4 h-4 text-emerald-500" />
            Ajustar Tela
          </button>
        </Panel>

        <Panel position="bottom-center" className="bg-neutral-900/80 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-6 shadow-2xl">
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <MousePointer2 className="w-4 h-4" />
            <span>Mover</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <Type className="w-4 h-4" />
            <span>Editar (2x Clique)</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={groupSelected}
            className="flex items-center gap-2 text-emerald-500/70 hover:text-emerald-500 text-sm font-bold transition-colors"
            title="Agrupar em Etapa (Ctrl+G)"
          >
            <Users className="w-4 h-4" />
            <span>Agrupar</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={duplicateSelected}
            className="flex items-center gap-2 text-emerald-500/70 hover:text-emerald-500 text-sm font-bold transition-colors"
            title="Duplicar selecionados (Ctrl+D)"
          >
            <Plus className="w-4 h-4" />
            <span>Duplicar</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={deleteSelected}
            className="flex items-center gap-2 text-red-500/70 hover:text-red-500 text-sm font-bold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir Selecionado</span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button 
            onClick={clearBoard}
            className="flex items-center gap-2 text-red-600 hover:text-red-500 text-sm font-bold transition-colors"
            title="Apagar tudo neste ambiente"
          >
            <X className="w-4 h-4" />
            <span>Limpar Quadro</span>
          </button>
        </Panel>
      </ReactFlow>

      {/* Edit Node Modal */}
      {editingNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">Editar {editingNode.type === 'group' ? 'Etapa' : 'Bloco'}</h3>
            
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Nome {editingNode.type === 'group' ? 'da Etapa' : 'do Bloco'}</label>
              <textarea
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full bg-neutral-800 border border-white/5 rounded-2xl py-4 px-6 text-xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors min-h-[80px] resize-none"
                placeholder={editingNode.type === 'group' ? 'Digite o nome da etapa...' : 'O que precisa ser feito?'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveNodeChanges();
                  }
                }}
              />
              <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-wider">Pressione Enter para salvar</p>
            </div>

            {editingNode.type !== 'group' && (
              <>
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center justify-between">
                    Cor do Bloco
                <span className="text-[10px] font-mono text-neutral-400">{editColor.toUpperCase()}</span>
              </label>
              
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="relative group shrink-0">
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div 
                    className="w-16 h-16 rounded-2xl border-4 border-white/10 shadow-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{ background: editColor }}
                  >
                    <Palette className="w-8 h-8 text-white mix-blend-difference opacity-50" />
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-hidden">
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setEditColor(c.value);
                        }}
                        className={`w-7 h-7 rounded-lg border-2 transition-all ${
                          editColor === c.value ? 'border-emerald-500 scale-110 shadow-lg' : 'border-white/5 opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ background: c.value }}
                      />
                    ))}
                  </div>
                  <input 
                    type="text"
                    value={editColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') || val === '') {
                        setEditColor(val);
                      }
                    }}
                    className="w-full bg-neutral-800/50 border border-white/5 rounded-xl py-2 px-4 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                <User className="w-3 h-3" />
                Atribuir a
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditAssignedTo(null)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    !editAssignedTo 
                      ? 'bg-emerald-500 text-black border-emerald-500' 
                      : 'bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/10'
                  }`}
                >
                  Ninguém
                </button>
                {members.map((member) => (
                  <button
                    key={member.uid}
                    type="button"
                    onClick={() => setEditAssignedTo(member.uid)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      editAssignedTo === member.uid 
                        ? 'bg-emerald-500 text-black border-emerald-500' 
                        : 'bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {member.photoURL ? (
                      <img src={member.photoURL} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-3 h-3" />
                    )}
                    <span className="truncate max-w-[100px]">{member.displayName || 'Membro'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Status do Bloco</label>
              <button
                onClick={() => setEditCompleted(!editCompleted)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  editCompleted 
                    ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg shadow-emerald-500/20' 
                    : 'bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckSquare className={`w-6 h-6 ${editCompleted ? 'text-black' : 'text-neutral-500'}`} />
                  <span className="font-bold text-left">Marcar como concluído</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${editCompleted ? 'border-black' : 'border-neutral-600'}`}>
                  {editCompleted && <div className="w-2.5 h-2.5 bg-black rounded-full" />}
                </div>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center justify-between">
                Configurações do Checklist
              </label>
              <button
                onClick={() => setEditStrikeThrough(!editStrikeThrough)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-neutral-800 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-neutral-500 group-hover:text-neutral-400" />
                  <span className="text-sm font-bold text-neutral-300">Riscar itens feitos</span>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${editStrikeThrough ? 'bg-emerald-500' : 'bg-neutral-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${editStrikeThrough ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Formato do Bloco</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'rounded', icon: RectangleHorizontal, label: 'Arredondado' },
                  { id: 'rect', icon: Square, label: 'Retângulo' },
                  { id: 'circle', icon: Circle, label: 'Círculo' },
                  { id: 'diamond', icon: Diamond, label: 'Diamante' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setEditShape(s.id as any)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                      editShape === s.id 
                        ? 'bg-emerald-500 text-black border-emerald-500' 
                        : 'bg-neutral-800 text-neutral-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <s.icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                <FileText className="w-3 h-3" />
                Notas do Bloco
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full bg-neutral-800 border border-white/5 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors min-h-[80px]"
                placeholder="Adicione observações..."
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                <ListTodo className="w-3 h-3" />
                Checklist
              </label>
              
              <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {editChecklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 bg-black/20 p-2 rounded-xl group">
                    <button 
                      onClick={() => toggleEditChecklistItem(item.id)}
                      className="text-neutral-500 hover:text-emerald-500 transition-colors"
                    >
                      {item.completed ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                    </button>
                    <span className={`text-sm flex-1 ${item.completed ? 'text-neutral-500 line-through' : 'text-white'}`}>
                      {item.text}
                    </span>
                    <button 
                      onClick={() => removeChecklistItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Novo item..."
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  className="flex-1 bg-neutral-800 border border-white/5 rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  onClick={addChecklistItem}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white p-2 rounded-xl border border-white/5 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            </>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setEditingNode(null)}
                className="flex-1 py-4 px-6 rounded-2xl font-semibold text-neutral-400 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveNodeChanges}
                disabled={!editLabel.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-4 px-6 rounded-2xl transition-colors"
              >
                Salvar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Share Modal */}
      {isSharing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">Link de Convite</h3>
            <p className="text-neutral-400 mb-6 text-sm">Qualquer pessoa com este link poderá ver e editar este fluxograma.</p>
            
            <div className="bg-black/50 border border-white/5 rounded-2xl p-4 mb-6 break-all font-mono text-xs text-emerald-500">
              {inviteUrl}
            </div>
            
            <button
              onClick={() => setIsSharing(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-4 px-6 rounded-2xl transition-colors"
            >
              Entendido! (Copiado)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
