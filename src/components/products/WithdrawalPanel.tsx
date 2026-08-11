import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useRetirada, useWithdrawals } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { Withdrawal } from '@/types';
import { Ban, Check, ClipboardCheck, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Retiradas pendentes: o que saiu para a loja e ainda não foi acertado.
 *
 * É aqui que se fecha o dia — informando quanto realmente vendeu. O que
 * sobrou continua no estoque, porque nunca chegou a sair.
 */
export function WithdrawalPanel() {
  const { data: pendentes } = useWithdrawals({ status: 'PENDENTE' });
  const [aprovando, setAprovando] = useState<Withdrawal | null>(null);
  const [cancelando, setCancelando] = useState<Withdrawal | null>(null);

  const toast = useToast();
  const cancelar = useRetirada('cancelar');

  async function confirmarCancelamento() {
    if (!cancelando) return;
    try {
      const r = await cancelar.mutateAsync({ id: cancelando.id });
      toast.success('Retirada cancelada', r.message);
      setCancelando(null);
    } catch (erro) {
      toast.error('Não foi possível cancelar', erro instanceof Error ? erro.message : undefined);
    }
  }

  const lista = pendentes?.data ?? [];

  return (
    <>
      <Card>
        <CardHeader
          title="Retiradas aguardando acerto"
          subtitle="Mercadoria na loja que ainda não baixou do estoque"
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

                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setAprovando(r)}
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                >
                  Acertar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setCancelando(r)}
                  icon={<Ban className="h-3.5 w-3.5" />}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ModalDeAcerto retirada={aprovando} aoFechar={() => setAprovando(null)} />

      <ConfirmDialog
        open={Boolean(cancelando)}
        title="Cancelar retirada"
        message={`As ${cancelando?.quantity ?? 0} un. voltam a ficar livres. Nenhuma baixa é feita — o estoque nunca chegou a sair.`}
        confirmLabel="Cancelar retirada"
        cancelLabel="Voltar"
        loading={cancelar.isPending}
        onConfirm={() => void confirmarCancelamento()}
        onCancel={() => setCancelando(null)}
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
