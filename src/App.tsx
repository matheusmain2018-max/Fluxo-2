import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, signInWithGoogle, logout, db } from './firebase';
import { WorkspaceList } from './components/WorkspaceList';
import { FlowEditor } from './components/FlowEditor';
import { InviteHandler } from './components/InviteHandler';
import { Logo } from './components/Logo';
import { LogIn, LogOut, Share2, Layout, Plus, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isInviteMode, setIsInviteMode] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        try {
          await setDoc(doc(db, 'users', user.uid), {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.error("Error syncing profile", e);
        }
      }
    });

    // Check for invite in URL
    const params = new URLSearchParams(window.location.search);
    if (params.has('invite')) {
      setIsInviteMode(true);
    }

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
        >
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Logo className="text-emerald-500" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">DEYEEFLUXO</h1>
          <p className="text-neutral-400 mb-8">Colabore em tempo real em fluxogramas incríveis com sua equipe.</p>
          
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white text-black font-semibold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-200 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (isInviteMode) {
    return <InviteHandler onComplete={() => setIsInviteMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      {/* Navigation */}
      <nav className="h-16 border-bottom border-white/5 bg-neutral-900/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveWorkspaceId(null)}
            className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <Logo className="text-emerald-500" size={28} />
            DEYEEFLUXO
          </button>
          
          {activeWorkspaceId && (
            <div className="flex items-center gap-2 text-neutral-500">
              <span className="text-lg">/</span>
              <span className="text-neutral-300 font-medium">Editor</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold">
              {user.displayName?.[0] || 'U'}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
          </div>
          
          <button
            onClick={logout}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="h-[calc(100vh-64px)]">
        <AnimatePresence mode="wait">
          {!activeWorkspaceId ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full"
            >
              <WorkspaceList onSelect={setActiveWorkspaceId} />
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full"
            >
              <FlowEditor workspaceId={activeWorkspaceId} onBack={() => setActiveWorkspaceId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
