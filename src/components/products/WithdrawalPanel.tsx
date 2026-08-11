import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRetirada, useWithdrawals } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { pode } from '@/lib/permissoes';
import type { Withdrawal } from '@/types';
import { Check, PackageCheck, SplitSquareHorizontal, X } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Retiradas pendentes: o que saiu para a loja e ainda não foi acertado.
 *
 * É aqui que se fecha o dia — informando quanto realmente vendeu. O que
 * sobrou continua no estoque, porque nunca chegou a sair.
 */
export function WithdrawalPanel() {
  const { data: pendentes } = useWithdrawals({ status: 'PENDENTE' });
  const [parcial, setParcial] = useState<Withdrawal | null>(null);
  const [aprovando, setAprovando] = useState<Withdrawal | null>(null);
  const [recusando, setRecusando] = useState<Withdrawal | null>(null);

  const { user } = useAuth();
  const toast = useToast();
  const aprovar = useRetirada('aprovar');
  const recusar = useRetirada('cancelar');

  // Quem decide é o dono da loja; o resto só consegue olhar.
  const podeDecidir = pode(user?.role, 'retirada.aprovar');

  async function confirmarAprovacao() {
    if (!aprovando) return;
    try {
      const r = await aprovar.mutateAsync({ id: aprovando.id, soldQuantity: aprovando.quantity });
      toast.success('Saída aprovada', r.message);
      setAprovando(null);
    } catch (erro) {
      toast.error('Não foi possível aprovar', erro instanceof Error ? erro.message : undefined);
    }
  }

  async function confirmarRecusa() {
    if (!recusando) return;
    try {
      const r = await recusar.mutateAsync({ id: recusando.id });
      toast.success('Retirada recusada', r.message);
      setRecusando(null);
    } catch (erro) {
      toast.error('Não foi possível recusar', erro instanceof Error ? erro.message : undefined);
    }
  }

  const lista = pendentes?.data ?? [];

  return (
    <>
      <Card>
        <CardHeader
          title="Retiradas aguardando sua aprovação"
          subtitle="Mercadoria na loja que só baixa do estoque quando você aprovar"
          action={
            lista.length > 0 && (
              <Badge tone="warning">
                {lista.length} pendente{lista.length > 1 ? 's' : ''}
              </Badge>
            )
          }
        />

        {lista.length === 0 ? (
          <CardBody>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <PackageCheck className="h-8 w-8 text-slate-300 dark:text-navy-600" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nada pendente. Tudo que saiu para a loja já foi acertado.
              </p>
            </div>
          </CardBody>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {lista.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                    {r.quantity}× {r.product.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {r.unit.name} · saiu em {formatDateTime(r.createdAt)}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </p>
                </div>

                {podeDecidir ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAprovando(r)}
                      title={`Aprovar: as ${r.quantity} un. saem do estoque`}
                      aria-label="Aprovar a saída"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-bg text-success transition hover:bg-success hover:text-white dark:bg-success/15"
                    >
                      <Check className="h-5 w-5" strokeWidth={3} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecusando(r)}
                      title="Recusar: nada sai do estoque"
                      aria-label="Recusar a retirada"
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger-bg text-danger transition hover:bg-danger hover:text-white dark:bg-danger/15"
                    >
                      <X className="h-5 w-5" strokeWidth={3} />
                    </button>

                    {/* Nem todo dia é tudo ou nada. */}
                    {r.quantity > 1 && (
                      <button
                        type="button"
                        onClick={() => setParcial(r)}
                        title="Saiu só uma parte"
                        aria-label="Informar quantas saíram"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-navy-700"
                      >
                        <SplitSquareHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <Badge tone="warning">Aguardando o administrador</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ModalDeAcerto retirada={parcial} aoFechar={() => setParcial(null)} />

      <ConfirmDialog
        open={Boolean(aprovando)}
        title="Aprovar a saída"
        message={`As ${aprovando?.quantity ?? 0} un. de ${aprovando?.product.name ?? ''} saem do estoque agora. Se só uma parte vendeu, volte e use “saiu só uma parte”.`}
        confirmLabel="Aprovar e baixar"
        cancelLabel="Voltar"
        variant="primary"
        loading={aprovar.isPending}
        onConfirm={() => void confirmarAprovacao()}
        onCancel={() => setAprovando(null)}
      />

      <ConfirmDialog
        open={Boolean(recusando)}
        title="Recusar a retirada"
        message={`As ${recusando?.quantity ?? 0} un. voltam a ficar livres. Nenhuma baixa é feita — o estoque nunca chegou a sair.`}
        confirmLabel="Recusar"
        cancelLabel="Voltar"
        loading={recusar.isPending}
        onConfirm={() => void confirmarRecusa()}
        onCancel={() => setRecusando(null)}
      />
    </>
  );
}

/** Pergunta quantas venderam e mostra o resultado antes de confirmar. */
function ModalDeAcerto({
  retirada,
  aoFechar,
}: {
  retirada: Withdrawal | null;
  aoFechar: () => void;
}) {
  const [vendidas, setVendidas] = useState('0');
  const toast = useToast();
  const aprovar = useRetirada('aprovar');

  useEffect(() => {
    if (retirada) setVendidas('0');
  }, [retirada]);

  if (!retirada) return null;

  const quantas = Number(vendidas) || 0;
  const voltam = retirada.quantity - quantas;
  const invalido = quantas < 0 || quantas > retirada.quantity;

  async function confirmar() {
    if (invalido) return;
    try {
      const r = await aprovar.mutateAsync({ id: retirada!.id, soldQuantity: quantas });
      toast.success('Retirada acertada', r.message);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível acertar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Modal
      open
      onClose={aoFechar}
      title="Acerto da retirada"
      description={`${retirada.quantity}× ${retirada.product.name} · ${retirada.unit.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={aprovar.isPending}>
            Voltar
          </Button>
          <Button
            variant="success"
            onClick={() => void confirmar()}
            loading={aprovar.isPending}
            disabled={invalido}
            icon={<Check className="h-4 w-4" />}
          >
            Confirmar acerto
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Atalhos para os dois casos mais comuns */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVendidas('0')}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
              quantas === 0
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
            )}
          >
            Nenhuma vendeu
          </button>
          <button
            type="button"
            onClick={() => setVendidas(String(retirada.quantity))}
            className={cn(
              'flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition',
              quantas === retirada.quantity
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
            )}
          >
            Vendeu tudo
          </button>
        </div>

        <Input
          label="Quantas realmente saíram?"
          type="number"
          min={0}
          max={retirada.quantity}
          value={vendidas}
          onChange={(e) => setVendidas(e.target.value)}
          error={invalido ? `Informe um número entre 0 e ${retirada.quantity}` : undefined}
          autoFocus
        />

        {!invalido && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-navy-700 dark:bg-navy-800">
            <p className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Baixa do estoque</span>
              <strong className="text-danger">−{quantas}</strong>
            </p>
            <p className="mt-1 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Voltam para o estoque</span>
              <strong className="text-success">{voltam}</strong>
            </p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Se você já registrou essas vendas na tela de <strong>Vendas</strong> (com cliente e forma de
          pagamento), o estoque já baixou — informe <strong>0</strong> aqui para não descontar duas
          vezes.
        </p>
      </div>
    </Modal>
  );
}
