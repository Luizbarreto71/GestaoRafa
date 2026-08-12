import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/contexts/ToastContext';
import { useDebounce } from '@/hooks/useDebounce';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate, PAYMENT_OPTIONS } from '@/lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  HandCoins,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';

type Cobranca = {
  id: string;
  amount: number;
  settledAt?: string | null;
  settledMethod?: string | null;
  dias: number;
  vendedor?: string | null;
  produtos: string;
  sale: {
    id: string;
    code: string;
    saleDate: string;
    customerName?: string | null;
    customerPhone?: string | null;
    unit?: { name: string } | null;
  };
};

type Resposta = {
  data: Cobranca[];
  meta: { total: number };
  resumo: { cobrancas: number; total: number };
};

/** Depois de quantos dias uma cobrança passa a incomodar. */
const ATRASO = 30;

/**
 * O que a loja tem a receber.
 *
 * Cada linha é uma venda que saiu fiada. Fica aqui até alguém dar baixa —
 * e com o telefone à mão, porque cobrança sem contato não é cobrança.
 */
export default function EmAbertoPage() {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<'abertos' | 'quitados' | 'todos'>('abertos');
  const [recebendo, setRecebendo] = useState<Cobranca | null>(null);

  const termo = useDebounce(busca, 300);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['em-aberto', termo, situacao],
    queryFn: async () => {
      const { data } = await api.get<Resposta>('/em-aberto', {
        params: { situacao, ...(termo ? { search: termo } : {}) },
      });
      return data;
    },
  });

  const reabrir = useMutation({
    mutationFn: (id: string) => api.post(`/em-aberto/${id}/reabrir`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Cobrança reaberta');
      void queryClient.invalidateQueries({ queryKey: ['em-aberto'] });
    },
    onError: (e) => toast.error('Não foi possível reabrir', getErrorMessage(e)),
  });

  const lista = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
          🤝 Valores em aberto
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Vendas que saíram fiadas e ainda não foram pagas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total a receber"
          value={formatCurrency(data?.resumo.total ?? 0)}
          hint={`${data?.resumo.cobrancas ?? 0} cobrança(s) em aberto`}
          icon={Wallet}
          tone="warning"
          loading={isLoading}
        />
        <StatCard
          label="Atrasadas"
          value={String(lista.filter((c) => !c.settledAt && c.dias > ATRASO).length)}
          hint={`Mais de ${ATRASO} dias sem pagar`}
          icon={HandCoins}
          tone="danger"
          loading={isLoading}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-[240px] flex-1">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar por nome, telefone ou número da venda…"
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          <div className="flex gap-1.5">
            {(
              [
                { chave: 'abertos' as const, rotulo: 'Em aberto' },
                { chave: 'quitados' as const, rotulo: 'Quitados' },
                { chave: 'todos' as const, rotulo: 'Todos' },
              ]
            ).map((op) => (
              <button
                key={op.chave}
                type="button"
                onClick={() => setSituacao(op.chave)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition',
                  situacao === op.chave
                    ? 'bg-navy-900 text-white dark:bg-accent'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800',
                )}
              >
                {op.rotulo}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {isLoading && <div className="skeleton h-32 w-full" />}

      {!isLoading && lista.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {situacao === 'abertos'
                ? 'Ninguém está devendo. 🎉'
                : 'Nenhuma cobrança encontrada.'}
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.map((c) => {
          const atrasada = !c.settledAt && c.dias > ATRASO;

          return (
            <Card key={c.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-navy-900 dark:text-slate-100">
                      {c.sale.customerName ?? 'Cliente'}
                    </p>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {c.sale.code} · {formatDate(c.sale.saleDate)}
                      {c.sale.unit ? ` · ${c.sale.unit.name}` : ''}
                    </p>
                  </div>

                  {c.settledAt ? (
                    <Badge tone="success">Quitado</Badge>
                  ) : (
                    <Badge tone={atrasada ? 'danger' : 'warning'}>
                      {c.dias === 0 ? 'hoje' : `${c.dias} dia${c.dias > 1 ? 's' : ''}`}
                    </Badge>
                  )}
                </div>

                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.produtos}</p>

                {/* O telefone é a razão de a tela existir: sem ele não há
                    como cobrar, e o valor vira prejuízo silencioso. */}
                {c.sale.customerPhone && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${c.sale.customerPhone.replace(/\D/g, '')}`}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {c.sale.customerPhone}
                    </a>
                    <a
                      href={`https://wa.me/55${c.sale.customerPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-success-bg px-2.5 py-1.5 text-xs font-semibold text-success transition hover:bg-success hover:text-white dark:bg-success/15"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
                  <span
                    className={cn(
                      'text-xl font-extrabold',
                      c.settledAt ? 'text-slate-400 line-through' : 'text-warning',
                    )}
                  >
                    {formatCurrency(c.amount)}
                  </span>

                  {c.settledAt ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reabrir.mutate(c.id)}
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                    >
                      Reabrir
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setRecebendo(c)}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    >
                      Recebi
                    </Button>
                  )}
                </div>

                {c.settledAt && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quitado em {formatDate(c.settledAt)}
                    {c.settledMethod ? ` · ${c.settledMethod}` : ''}
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <ModalDeBaixa cobranca={recebendo} aoFechar={() => setRecebendo(null)} />
    </div>
  );
}

/** Pergunta como o cliente pagou antes de dar baixa. */
function ModalDeBaixa({
  cobranca,
  aoFechar,
}: {
  cobranca: Cobranca | null;
  aoFechar: () => void;
}) {
  const [forma, setForma] = useState('PIX');
  const toast = useToast();
  const queryClient = useQueryClient();

  const receber = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ message: string }>(`/em-aberto/${cobranca!.id}/receber`, {
        method: forma,
      });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Cobrança quitada', r.message);
      void queryClient.invalidateQueries({ queryKey: ['em-aberto'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      aoFechar();
    },
    onError: (e) => toast.error('Não foi possível dar baixa', getErrorMessage(e)),
  });

  if (!cobranca) return null;

  return (
    <Modal
      open
      onClose={aoFechar}
      title="Recebi o pagamento"
      description={`${cobranca.sale.customerName ?? 'Cliente'} · ${cobranca.sale.code}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={receber.isPending}>
            Cancelar
          </Button>
          <Button
            variant="success"
            loading={receber.isPending}
            onClick={() => receber.mutate()}
            icon={<CheckCircle2 className="h-4 w-4" />}
          >
            Confirmar recebimento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-center dark:bg-navy-800">
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Valor da cobrança</p>
          <p className="text-3xl font-extrabold text-navy-900 dark:text-slate-50">
            {formatCurrency(cobranca.amount)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            em aberto há {cobranca.dias} dia{cobranca.dias === 1 ? '' : 's'}
          </p>
        </div>

        <Select
          label="Como o cliente pagou"
          value={forma}
          onChange={(e) => setForma(e.target.value)}
          options={PAYMENT_OPTIONS.filter((o) => o.value !== 'EM_ABERTO')}
        />

        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          A venda original não muda: ela pertence ao dia em que foi feita, e mexer nela reescreveria
          aquele fechamento de caixa. A baixa fica registrada com a data de hoje.
        </p>
      </div>
    </Modal>
  );
}
