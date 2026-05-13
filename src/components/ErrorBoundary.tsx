import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let isQuotaError = false;
      try {
        const errorData = JSON.parse(this.state.error?.message || '{}');
        isQuotaError = errorData.error?.includes('Quota limit exceeded') || errorData.error?.includes('Quota exceeded');
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">
              {isQuotaError ? 'Limite de Uso Atingido' : 'Ops! Algo deu errado'}
            </h2>
            
            <p className="text-neutral-400 mb-8">
              {isQuotaError 
                ? 'O limite diário de leitura do banco de dados foi atingido. O acesso será restaurado automaticamente amanhã.' 
                : 'Ocorreu um erro inesperado ao carregar o aplicativo.'}
            </p>

            {isQuotaError && (
              <div className="bg-black/50 border border-white/5 rounded-2xl p-4 mb-8 text-left">
                <p className="text-xs text-neutral-500 mb-2 uppercase tracking-widest font-bold">Dica</p>
                <p className="text-sm text-neutral-400">
                  O Firebase (nosso banco de dados) possui um limite gratuito diário. 
                  Você pode conferir mais detalhes em <a href="https://firebase.google.com/pricing" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">firebase.google.com/pricing</a>.
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-white text-black font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 hover:bg-neutral-200 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
