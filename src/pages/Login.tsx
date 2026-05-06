import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('axium.contato@gmail.com');
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
        navigate('/crm/painel');
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

          <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-black text-black tracking-tight mb-1">Bem-vindo de volta</h2>
            <p className="text-neutral-500 text-xs md:text-sm">Faça login para acessar o painel.</p>
          </div>

          {error && (
            <div className="mb-4 md:mb-6 p-2 md:p-3.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-xs md:text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 md:space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] md:text-xs font-bold text-neutral-600 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border border-neutral-200 rounded-md py-2 md:py-3 pl-10 md:pl-11 pr-4 text-black text-xs md:text-sm placeholder-neutral-400 focus:outline-none focus:border-black transition-colors bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[10px] md:text-xs font-bold text-neutral-600 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha secreta"
                  className="w-full border border-neutral-200 rounded-md py-3 pl-11 pr-12 text-black text-sm placeholder-neutral-400 focus:outline-none focus:border-black transition-colors bg-white"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-md transition-colors flex items-center justify-center gap-2 text-sm mt-6"
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