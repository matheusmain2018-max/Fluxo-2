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
import { OperationType } from '../types';
import { handleFirestoreError } from '../utils';
import { ChevronLeft, Plus, Share2, Trash2, MousePointer2, Type, X, Maximize } from 'lucide-react';
import { nanoid } from 'nanoid';
import { motion } from 'motion/react';
import CustomEdge from './CustomEdge';
import CustomNode from './CustomNode';

const edgeTypes = {
  custom: CustomEdge,
};

const nodeTypes = {
  custom: CustomNode,
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
  const { setCenter, getNodes, fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  // Sync Nodes
  useEffect(() => {
    const q = query(collection(db, `workspaces/${workspaceId}/nodes`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNodes: Node[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        newNodes.push({ 
          id: docSnapshot.id, 
          ...data,
          type: 'custom' // Force custom type for all nodes
        } as Node);
      });
      setNodes(newNodes);
    });
    return () => unsubscribe();
  }, [workspaceId]);

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
    });
    return () => unsubscribe();
  }, [workspaceId]);

  // Sync Workspace Info
  useEffect(() => {
    const fetchWorkspace = async () => {
      const docRef = doc(db, 'workspaces', workspaceId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setWorkspaceName(docSnap.data().name);
      }
    };
    fetchWorkspace();
  }, [workspaceId]);

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
          await deleteDoc(doc(db, `workspaces/${workspaceId}/nodes`, change.id));
        }
      }
    },
    [workspaceId]
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
    },
    []
  );

  const saveNodeChanges = async () => {
    if (!editingNode) return;
    
    console.log('Attempting to save node changes:', { id: editingNode.id, editLabel, editColor });
    
    try {
      const nodeRef = doc(db, `workspaces/${workspaceId}/nodes`, editingNode.id);
      
      await updateDoc(nodeRef, {
        'data.label': editLabel,
        'data.color': editColor,
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
        await deleteDoc(doc(db, `workspaces/${workspaceId}/nodes`, node.id));
      }
    },
    [workspaceId]
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
          await deleteDoc(doc(db, `workspaces/${workspaceId}/nodes`, node.id));
        }
        for (const edge of selectedEdges) {
          await deleteDoc(doc(db, `workspaces/${workspaceId}/edges`, edge.id));
        }
      } catch (error) {
        console.error('Error deleting selected:', error);
      }
    }
  }, [nodes, edges, workspaceId]);

  const addNode = useCallback(async () => {
    const id = nanoid();
    const newNode = {
      id,
      type: 'custom',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        label: 'Novo Bloco',
        color: '#171717'
      },
    };
    await setDoc(doc(db, `workspaces/${workspaceId}/nodes`, id), newNode);
  }, [workspaceId]);

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
        selectNodesOnDrag={false}
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
        </Panel>

        <Panel position="top-right" className="flex items-center gap-2">
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
            onClick={deleteSelected}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir Selecionado</span>
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
            <h3 className="text-2xl font-bold mb-6">Editar Bloco</h3>
            
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">Cor do Bloco</label>
              <div className="grid grid-cols-5 gap-3">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditColor(c.value);
                    }}
                    className={`w-full aspect-square rounded-xl border-4 transition-all duration-200 ${
                      editColor === c.value 
                        ? 'border-white scale-110 shadow-xl' 
                        : 'border-white/5 opacity-40 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{ background: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Texto do Bloco</label>
              <textarea
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full bg-neutral-800 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-emerald-500 transition-colors min-h-[100px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveNodeChanges();
                  }
                }}
              />
              <p className="text-[10px] text-neutral-500 mt-2 uppercase tracking-wider">Pressione Enter para salvar</p>
            </div>
            
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
