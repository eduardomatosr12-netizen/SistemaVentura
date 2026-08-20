import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        navigate('/home');
      } else {
        setError(result.error || 'E-mail ou senha incorretos');
      }
    } catch (err) {
      console.error('[LOGIN] Error:', err);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-black flex">
      <div className="hidden lg:flex lg:w-1/2 bg-black flex-col justify-between p-12">
        <img src="/logo.jpg" alt="VENTURA" className="w-full max-w-[160px] object-contain" />
        <div>
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight mb-4">
            Transformando Ambientes,<br />Criando Experiências.
          </h1>
            <p className="text-white text-lg font-medium">
             Gestão inteligente de iluminação e efeitos especiais.
           </p>
        </div>
        <p className="text-white text-sm">© 2026 Ventura Luz e Efeitos · v1.0.0</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 md:mb-10 flex justify-center">
             <img src="/logo.jpg" alt="VENTURA" className="w-full max-w-[180px] object-contain" />
           </div>

          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1">Bem-vindo de volta</h2>
            <p className="text-white text-xs md:text-sm">Faça login para acessar o painel.</p>
          </div>

          {error && (
            <div className="mb-4 md:mb-6 p-2 md:p-3.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-xs md:text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] md:text-xs font-bold text-white uppercase tracking-wider">
                 Email
               </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="seu@email.com"
                   className="w-full border border-neutral-200 rounded-md py-2 md:py-3 pl-10 md:pl-11 pr-4 text-black text-xs md:text-sm placeholder-neutral-400 focus:outline-none focus:border-[#B5FF03] focus:ring-1 focus:ring-[#B5FF03] transition-colors bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[10px] md:text-xs font-bold text-white uppercase tracking-wider">
                 Senha
               </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Sua senha secreta"
                   className="w-full border border-neutral-200 rounded-md py-3 pl-11 pr-12 text-black text-sm placeholder-neutral-400 focus:outline-none focus:border-[#B5FF03] focus:ring-1 focus:ring-[#B5FF03] transition-colors bg-white"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#B5FF03] transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
               className="w-full bg-[#B5FF03] hover:bg-[#a1e600] disabled:bg-neutral-300 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-md transition-colors flex items-center justify-center gap-2 text-sm mt-6"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
              ) : (
                'Entrar no sistema'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;