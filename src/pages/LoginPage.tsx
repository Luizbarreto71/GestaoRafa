import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { BarChart3, Eye, EyeOff, Lock, Mail, Package, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Bem-vindo de volta!');
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar';
      setError(message);
      toast.error('Falha no login', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Painel da marca — some no celular */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-900 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #2563EB 0, transparent 45%), radial-gradient(circle at 80% 70%, #16A34A 0, transparent 45%)',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-extrabold text-white">
            R
          </div>
          <div>
            <p className="text-lg font-bold text-white">Rafa Multimarcas</p>
            <p className="text-xs text-slate-400">Controle de estoque</p>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold leading-tight text-white">
            Todo o seu estoque
            <br />
            sob controle.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
            Celulares, TG, JBL, notebooks e video games em um só lugar. Cada venda baixa o estoque
            automaticamente e vai para a planilha.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: Package, label: 'Estoque em tempo real' },
              { icon: BarChart3, label: 'Relatórios completos' },
              { icon: ShieldCheck, label: 'Histórico auditado' },
            ].map((feature) => (
              <div key={feature.label} className="rounded-xl bg-white/5 p-4 backdrop-blur">
                <feature.icon className="h-5 w-5 text-accent-soft" />
                <p className="mt-2 text-xs font-medium text-slate-300">{feature.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} Rafa Multimarcas · Todos os direitos reservados
        </p>
      </div>

      {/* Formulário */}
      <div className="flex w-full items-center justify-center bg-slate-100 p-6 dark:bg-navy-950 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-lg font-extrabold text-white">
              R
            </div>
            <div>
              <p className="text-base font-bold text-navy-900 dark:text-slate-100">Rafa Multimarcas</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Controle de estoque</p>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-navy-900 dark:text-slate-50">Entrar no sistema</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Informe suas credenciais para acessar o painel.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@rafamultimarcas.com"
              icon={<Mail className="h-4 w-4" />}
              autoComplete="email"
              required
              autoFocus
            />

            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[34px] text-slate-400 transition hover:text-navy-900 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2.5 text-sm font-medium text-danger dark:bg-danger/10">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Esqueceu a senha? Peça ao administrador para redefinir em Configurações → Usuários.
          </p>
        </div>
      </div>
    </div>
  );
}
