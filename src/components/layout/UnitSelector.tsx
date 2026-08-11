import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useCrudMutation } from '@/hooks/queries';
import { unitService } from '@/services';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { Building2, Check, ChevronDown, Plus, Store } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

/**
 * Escolhe qual unidade está sendo olhada.
 *
 * Para gerente e vendedor não é um seletor: é só a etiqueta da unidade
 * deles, já que não podem trocar.
 */
export function UnitSelector() {
  const { unidades, unidadeId, definirUnidade, podeTrocar, rotulo, carregando } = useUnit();
  const { isAdmin } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  if (carregando || !unidades.length) return null;

  const Icone = unidadeId ? Store : Building2;

  // O administrador precisa do seletor mesmo com uma unidade só — é por ele
  // que se cria a segunda loja.
  if (!podeTrocar && !isAdmin) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-navy-800">
        <Icone className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">{rotulo}</span>
      </div>
    );
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy-900 transition hover:bg-slate-50 dark:border-navy-600 dark:text-slate-100 dark:hover:bg-navy-800"
      >
        <Icone className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="max-w-[9rem] truncate">{rotulo}</span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-11 z-50 w-56 animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal dark:border-navy-700 dark:bg-navy-800">
          <Opcao
            rotulo="Todas as unidades"
            descricao="Visão consolidada"
            icone={<Building2 className="h-4 w-4" />}
            marcada={unidadeId === null}
            aoEscolher={() => {
              definirUnidade(null);
              setAberto(false);
            }}
          />

          <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

          {unidades.map((u) => (
            <Opcao
              key={u.id}
              rotulo={u.name}
              descricao={u.type === 'MATRIZ' ? 'Matriz' : 'Filial'}
              icone={<Store className="h-4 w-4" />}
              marcada={unidadeId === u.id}
              aoEscolher={() => {
                definirUnidade(u.id);
                setAberto(false);
              }}
            />
          ))}

          {isAdmin && (
            <>
              <div className="my-1 border-t border-slate-200 dark:border-navy-700" />
              <button
                type="button"
                onClick={() => {
                  setAberto(false);
                  setCriando(true);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-accent transition hover:bg-accent/5"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold">Nova unidade</span>
              </button>
            </>
          )}
        </div>
      )}

      <ModalNovaUnidade aberto={criando} aoFechar={() => setCriando(false)} />
    </div>
  );
}

/** Cria uma loja nova sem sair da tela. */
function ModalNovaUnidade({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [form, setForm] = useState({ name: '', type: 'FILIAL' as 'MATRIZ' | 'FILIAL' });
  const toast = useToast();
  const { definirUnidade } = useUnit();

  const criar = useCrudMutation(
    (dados: Record<string, unknown>) => unitService.create(dados),
    'units',
  );

  useEffect(() => {
    if (aberto) setForm({ name: '', type: 'FILIAL' });
  }, [aberto]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.warning('Informe o nome da unidade');

    try {
      const nova = await criar.mutateAsync({ ...form, name: form.name.trim() });
      toast.success('Unidade criada', `${nova.name} já pode receber estoque.`);
      definirUnidade(nova.id);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível criar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Nova unidade"
      description="Cada unidade tem seu próprio estoque, separado das demais"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nova-unidade" loading={criar.isPending}>
            Criar unidade
          </Button>
        </>
      }
    >
      <form id="form-nova-unidade" onSubmit={enviar} className="space-y-4">
        <Input
          label="Nome"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Loja Centro, Depósito, Quiosque…"
          autoFocus
        />
        <Select
          label="Tipo"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'MATRIZ' | 'FILIAL' }))}
          options={[
            { value: 'FILIAL', label: 'Filial' },
            { value: 'MATRIZ', label: 'Matriz' },
          ]}
        />
      </form>
    </Modal>
  );
}

function Opcao({
  rotulo,
  descricao,
  icone,
  marcada,
  aoEscolher,
}: {
  rotulo: string;
  descricao: string;
  icone: React.ReactNode;
  marcada: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition',
        marcada ? 'bg-accent/10' : 'hover:bg-slate-100 dark:hover:bg-navy-700',
      )}
    >
      <span className={cn('shrink-0', marcada ? 'text-accent' : 'text-slate-400')}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-semibold',
            marcada ? 'text-accent' : 'text-navy-900 dark:text-slate-100',
          )}
        >
          {rotulo}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{descricao}</span>
      </span>
      {marcada && <Check className="h-4 w-4 shrink-0 text-accent" />}
    </button>
  );
}
