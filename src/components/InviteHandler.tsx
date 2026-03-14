import React, { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OperationType } from '../types';
import { handleFirestoreError } from '../utils';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { Share2, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface InviteHandlerProps {
  onComplete: () => void;
}

export function InviteHandler({ onComplete }: InviteHandlerProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const processInvite = async () => {
      const params = new URLSearchParams(window.location.search);
      const inviteId = params.get('invite');

      if (!inviteId || !auth.currentUser) {
        setStatus('error');
        setErrorMsg('Link de convite inválido ou você não está logado.');
        return;
      }

      try {
        // 1. Get invite
        const inviteRef = doc(db, 'invites', inviteId);
        const inviteSnap = await getDoc(inviteRef);

        if (!inviteSnap.exists()) {
          setStatus('error');
          setErrorMsg('Este convite expirou ou não existe.');
          return;
        }

        const { workspaceId } = inviteSnap.data();

        // 2. Add user to workspace members
        const workspaceRef = doc(db, 'workspaces', workspaceId);
        await updateDoc(workspaceRef, {
          members: arrayUnion(auth.currentUser.uid)
        });

        setStatus('success');
        
        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
          onComplete();
        }, 2000);

      } catch (error) {
        console.error(error);
        setStatus('error');
        setErrorMsg('Ocorreu um erro ao processar seu convite.');
      }
    };

    processInvite();
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-white/10 p-10 rounded-[40px] max-w-md w-full text-center shadow-2xl"
      >
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Logo className="text-emerald-500" size={48} />
        </div>

        {status === 'loading' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Processando Convite...</h2>
            <p className="text-neutral-500 mb-8 text-sm">Estamos preparando seu acesso ao ambiente compartilhado.</p>
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
          </>
        )}

        {status === 'success' && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-emerald-500 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              Sucesso!
            </h2>
            <p className="text-neutral-400 mb-8">Você agora faz parte deste ambiente. Redirecionando...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-red-500 flex items-center justify-center gap-2">
              <XCircle className="w-6 h-6" />
              Ops!
            </h2>
            <p className="text-neutral-400 mb-8">{errorMsg}</p>
            <button
              onClick={onComplete}
              className="w-full bg-white text-black font-bold py-4 px-6 rounded-2xl transition-colors"
            >
              Voltar ao Início
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
