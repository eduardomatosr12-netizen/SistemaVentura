import { useState, useEffect } from 'react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

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
    <div className="min-h-dvh bg-black flex relative overflow-hidden">
      {/* Animated background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[800px] h-[800px] rounded-full bg-[#CDFF00] opacity-[0.03] blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-[30%] -left-[15%] w-[600px] h-[600px] rounded-full bg-[#CDFF00] opacity-[0.02] blur-[100px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-between p-12 xl:p-16">
        <div
          className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ transitionDelay: '100ms' }}
        >
          <div className="flex items-center gap-4 mb-2">
            <img src="/logo.jpg" alt="VENTURA" className="w-20 h-20 xl:w-24 xl:h-24 object-contain rounded-xl" />
            <div>
              <h2 className="text-2xl xl:text-3xl font-black text-white tracking-tight leading-none">VENTURA</h2>
              <p className="text-[10px] font-black text-[#CDFF00] uppercase tracking-[4px]">Luz & Efeitos</p>
            </div>
          </div>
        </div>

        <div
          className={`transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '300ms' }}
        >
          <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-black text-white leading-[1.1] tracking-tight mb-6">
            Apague o comum,<br />
            <span className="text-[#CDFF00]">Acenda o extraordinário.</span>
          </h1>
          <p className="text-white/50 text-base xl:text-lg font-medium max-w-md leading-relaxed mb-10">
            Gestão inteligente de iluminação e efeitos especiais para sua empresa.
          </p>
        </div>

        <p
          className={`text-white/20 text-xs transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDelay: '900ms' }}
        >
          © 2026 Ventura Luz e Efeitos · v1.0.0
        </p>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative z-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div
            className={`lg:hidden mb-10 flex flex-col items-center gap-3 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ transitionDelay: '100ms' }}
          >
            <img src="/logo.jpg" alt="VENTURA" className="w-16 h-16 object-contain rounded-xl" />
            <div className="text-center">
              <h2 className="text-xl font-black text-white tracking-tight">VENTURA</h2>
              <p className="text-[9px] font-black text-[#CDFF00] uppercase tracking-[3px]">Luz & Efeitos</p>
            </div>
          </div>

          {/* Login card */}
          <div
            className={`bg-[#111] border border-[#222] rounded-2xl p-8 xl:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all duration-700 ease-out hover:shadow-[0_25px_70px_rgba(0,0,0,0.9)] ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            style={{ transitionDelay: '200ms' }}
          >
            <div className="mb-8">
              <h2 className="text-xl font-black text-white tracking-tight mb-1">Bem-vindo de volta</h2>
              <p className="text-white/40 text-xs font-medium">Faça login para acessar o painel.</p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff4444]/20 flex items-center justify-center shrink-0">
                  <span className="text-sm">✕</span>
                </div>
                <p className="text-[#ff4444] text-xs font-bold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div
                className={`space-y-2 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <label htmlFor="email" className="block text-[10px] font-black text-white/60 uppercase tracking-[2px]">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#CDFF00] transition-colors" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="seu@email.com"
                    className="w-full bg-black border border-[#2d2d2d] rounded-xl py-3.5 pl-12 pr-4 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#CDFF00] focus:shadow-[0_0_0_3px_rgba(205,255,0,0.1)] transition-all duration-200 font-medium"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div
                className={`space-y-2 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={{ transitionDelay: '500ms' }}
              >
                <label htmlFor="password" className="block text-[10px] font-black text-white/60 uppercase tracking-[2px]">
                  Senha
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#CDFF00] transition-colors" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Sua senha secreta"
                    className="w-full bg-black border border-[#2d2d2d] rounded-xl py-3.5 pl-12 pr-12 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#CDFF00] focus:shadow-[0_0_0_3px_rgba(205,255,0,0.1)] transition-all duration-200 font-medium"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/30 hover:text-[#CDFF00] focus:text-[#CDFF00] focus:outline-none transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div
                className={`transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                style={{ transitionDelay: '600ms' }}
              >
                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="w-full bg-[#CDFF00] hover:bg-[#a1e600] disabled:bg-[#333] disabled:text-white/30 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-xs uppercase tracking-[3px] mt-8 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(205,255,0,0.3)] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar no sistema'
                  )}
                </button>
              </div>
            </form>

            <div
              className={`mt-8 text-center transition-all duration-500 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: '700ms' }}
            >
              <p className="text-white/25 text-[11px] font-medium">
                Esqueceu sua senha?{' '}
                <button type="button" className="text-[#CDFF00] hover:text-[#a1e600] transition-colors font-bold underline underline-offset-2">
                  Recuperar
                </button>
              </p>
            </div>
          </div>

          {/* Mobile footer */}
          <div
            className={`lg:hidden mt-8 text-center transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDelay: '800ms' }}
          >
            <p className="text-white/15 text-[10px] font-medium">
              © 2026 Ventura Luz e Efeitos · v1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
