import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Workspace, OperationType } from '../types';
import { handleFirestoreError } from '../utils';
import { Plus, Layout, Users, ArrowRight, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface WorkspaceListProps {
  onSelect: (id: string) => void;
}

export function WorkspaceList({ onSelect }: WorkspaceListProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [deletingWorkspace, setDeletingWorkspace] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to workspaces where user is owner or member
    // Note: Firestore doesn't support OR queries easily for array-contains and equality across fields
    // So we'll fetch both or use a simpler approach for this demo
    const q = query(
      collection(db, 'workspaces'),
      where('members', 'array-contains', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ws: Workspace[] = [];
      snapshot.forEach((doc) => {
        ws.push({ id: doc.id, ...doc.data() } as Workspace);
      });
      setWorkspaces(ws);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workspaces');
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, 'workspaces'), {
        name: newName,
        ownerId: auth.currentUser.uid,
        members: [auth.currentUser.uid],
        createdAt: serverTimestamp(),
      });
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'workspaces');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setDeletingWorkspace({ id, name });
  };

  const confirmDelete = async () => {
    if (!deletingWorkspace) return;

    try {
      await deleteDoc(doc(db, 'workspaces', deletingWorkspace.id));
      setDeletingWorkspace(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `workspaces/${deletingWorkspace.id}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-bold tracking-tight mb-2">Seus Ambientes</h2>
          <p className="text-neutral-500">Gerencie seus espaços de trabalho virtuais.</p>
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-5 h-5" />
          Novo Ambiente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workspaces.map((ws) => (
          <motion.div
            key={ws.id}
            whileHover={{ y: -4, scale: 1.02 }}
            onClick={() => onSelect(ws.id)}
            className="group bg-neutral-900 border border-white/5 p-6 rounded-3xl text-left hover:border-emerald-500/50 transition-all shadow-xl cursor-pointer relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-neutral-800 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                <Layout className="text-neutral-400 group-hover:text-emerald-500 w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-neutral-500 text-sm font-medium">
                  <Users className="w-4 h-4" />
                  {ws.members.length}
                </div>
                {ws.ownerId === auth.currentUser?.uid && (
                  <button
                    onClick={(e) => handleDelete(e, ws.id, ws.name)}
                    className="p-2 hover:bg-red-500/10 rounded-xl text-neutral-500 hover:text-red-500 transition-colors relative z-10"
                    title="Excluir Ambiente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1 group-hover:text-emerald-500 transition-colors">{ws.name}</h3>
            <p className="text-neutral-500 text-sm mb-6">Criado por você</p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-600">Abrir Editor</span>
              <ArrowRight className="w-5 h-5 text-neutral-700 group-hover:text-emerald-500 transition-colors" />
            </div>
          </motion.div>
        ))}

        {workspaces.length === 0 && !isCreating && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-neutral-600 font-medium">Você ainda não tem ambientes. Crie um para começar!</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">Novo Ambiente</h3>
            <form onSubmit={handleCreate}>
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Nome do Ambiente</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Projeto Alpha"
                  className="w-full bg-neutral-800 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-4 px-6 rounded-2xl font-semibold text-neutral-400 hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-4 px-6 rounded-2xl transition-colors"
                >
                  Criar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingWorkspace && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
              <Trash2 className="text-red-500 w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Excluir Ambiente</h3>
            <p className="text-neutral-400 mb-8">
              Tem certeza que deseja excluir o ambiente <span className="text-white font-semibold">"{deletingWorkspace.name}"</span>? 
              Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingWorkspace(null)}
                className="flex-1 py-4 px-6 rounded-2xl font-semibold text-neutral-400 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-2xl transition-colors"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
