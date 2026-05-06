import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Link de recuperação expirado ou inválido. Por favor, solicite um novo link.');
      }
      
      setIsCheckingSession(false);
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!password || !confirmPassword) {
        setError('Por favor, preencha todos os campos.');
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('As senhas não conferem.');
        setIsLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess('Senha atualizada com sucesso!');
      await supabase.auth.signOut();
      localStorage.removeItem('axium_auth');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError('Erro ao atualizar senha. Tente novamente.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <img src="/logo.png" alt="Universo Axium" className="h-10 w-auto object-contain filter brightness-0 invert" />
        <div>
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight mb-4">
            Acelerando<br />o Crescimento.
          </h1>
          <p className="text-neutral-400 text-lg font-medium">
            Sistema de gestão interno para resultados extraordinários.
          </p>
        </div>
        <p className="text-neutral-600 text-sm">© 2026 Universo Axium · v1.0.0</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 md:mb-10 text-center">
            <img src="/logo.png" alt="Universo Axium" className="h-8 md:h-10 w-auto mx-auto object-contain" />
          </div>

          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 text-neutral-500 hover:text-black transition-colors mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para login
          </button>

          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-black text-black tracking-tight mb-1">Nova Senha</h2>
            <p className="text-neutral-500 text-xs md:text-sm">Digite sua nova senha abaixo.</p>
          </div>

          {(error || success) && (
            <div className={`mb-4 md:mb-6 p-2 md:p-3.5 ${success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} rounded-md`}>
              <p className={`${success ? 'text-green-600' : 'text-red-600'} text-xs md:text-sm font-medium`}>{success || error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block text-[10px] md:text-xs font-bold text-neutral-600 uppercase tracking-wider">
                Nova Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-neutral-200 rounded-md py-3 pl-11 pr-12 text-sm placeholder-neutral-400 focus:outline-none focus:border-black transition-colors bg-white"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="block text-[10px] md:text-xs font-bold text-neutral-600 uppercase tracking-wider">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full border border-neutral-200 rounded-md py-3 pl-11 pr-12 text-sm placeholder-neutral-400 focus:outline-none focus:border-black transition-colors bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isCheckingSession}
              className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-md transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Atualizando...</>
              ) : isCheckingSession ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
              ) : (
                'Atualizar senha'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;
