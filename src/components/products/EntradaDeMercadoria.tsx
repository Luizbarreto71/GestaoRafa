import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useMovimentarEstoque, useSuppliers } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { custoMedio } from '@shared/custo';
import type { Product } from '@/types';
import { PackagePlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

const VAZIO = { quantity: '1', costPrice: '', unitId: '', supplierId: '', notes: '' };

/**
 * Chegou mercadoria de um produto que já existe.
 *
 * É a nota entrando item a item: quantidade e o que se pagou por unidade.
 * O custo médio é recalculado na hora e mostrado antes de gravar, porque
 * quem lança precisa ver o efeito no custo enquanto ainda dá para corrigir.
 */
export function EntradaDeMercadoria({
  produto,
  aoFechar,
}: {
  produto: Product | null;
  aoFechar: () => void;
}) {
  const [form, setForm] = useState(VAZIO);
  const { unidades, unidadeId } = useUnit();
  const { data: fornecedores } = useSuppliers();
  const entrada = useMovimentarEstoque('entrada');
  const toast = useToast();

  useEffect(() => {
    if (!produto) return;
    setForm({
      ...VAZIO,
      unitId: unidadeId ?? unidades[0]?.id ?? '',
      supplierId: produto.supplierId ?? '',
    });
  }, [produto, unidadeId, unidades]);

  if (!produto) return null;

  const quantidade = Number(form.quantity) || 0;
  const nota = form.costPrice === '' ? null : Number(form.costPrice) || 0;

  const saldoAtual = produto.totalQuantity ?? produto.quantity ?? 0;
  const medioAtual = produto.costPrice ?? 0;
  const medioNovo = nota == null ? medioAtual : custoMedio(saldoAtual, medioAtual, quantidade, nota);

  const alterar = (campo: keyof typeof VAZIO, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (quantidade < 1) return toast.warning('Informe a quantidade que chegou');
    if (!form.unitId) return toast.warning('Escolha para qual estoque a mercadoria entra');

    try {
      const r = await entrada.mutateAsync({
        productId: produto!.id,
        unitId: form.unitId,
        quantity: quantidade,
        ...(nota != null ? { costPrice: nota } : {}),
        ...(form.supplierId ? { supplierId: form.supplierId } : {}),
        reason: 'COMPRA',
        notes: form.notes.trim() || null,
      });

      toast.success('Entrada registrada', r.message);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível registrar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Modal
      open
      onClose={aoFechar}
      title="Entrada de mercadoria"
      description={produto.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={entrada.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-entrada"
            loading={entrada.isPending}
            icon={<PackagePlus className="h-4 w-4" />}
          >
            Lançar entrada
          </Button>
        </>
      }
    >
      <form id="form-entrada" onSubmit={enviar} className="space-y-4">
        {/* O que já existe hoje, para comparar com o que está chegando. */}
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-center dark:bg-navy-800">
          <div>
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Em estoque</p>
            <p className="text-lg font-bold text-navy-900 dark:text-slate-100">{saldoAtual} un.</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Custo médio</p>
            <p className="text-lg font-bold text-navy-900 dark:text-slate-100">
              {formatCurrency(medioAtual)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-slate-500 dark:text-slate-400">Última compra</p>
            <p className="text-lg font-bold text-slate-500 dark:text-slate-400">
              {produto.lastPurchaseCost != null ? formatCurrency(produto.lastPurchaseCost) : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Quantidade que chegou"
            type="number"
            min={1}
            required
            value={form.quantity}
            onChange={(e) => alterar('quantity', e.target.value)}
            autoFocus
          />
          <Input
            label="Valor unitário pago"
            type="number"
            min={0}
            step="0.01"
            placeholder="0,00"
            value={form.costPrice}
            onChange={(e) => alterar('costPrice', e.target.value)}
            hint="O que está na nota, por peça"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Entra no estoque de"
            required
            value={form.unitId}
            onChange={(e) => alterar('unitId', e.target.value)}
            options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            label="Fornecedor"
            value={form.supplierId}
            onChange={(e) => alterar('supplierId', e.target.value)}
            options={(fornecedores?.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
            placeholder="Sem fornecedor"
          />
        </div>

        {/* A conta feita à vista, antes de gravar. */}
        {nota != null && quantidade > 0 && (
          <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
            <p className="mb-1.5 text-xs font-bold uppercase text-accent">Como fica o custo médio</p>

            <p className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>
                {saldoAtual} un. que você já tinha × {formatCurrency(medioAtual)}
              </span>
              <span>{formatCurrency(saldoAtual * medioAtual)}</span>
            </p>
            <p className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>
                {quantidade} un. desta nota × {formatCurrency(nota)}
              </span>
              <span>{formatCurrency(quantidade * nota)}</span>
            </p>

            <p className="mt-2 flex items-center justify-between border-t border-accent/20 pt-2">
              <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">
                {saldoAtual + quantidade} un. · novo custo médio
              </span>
              <strong
                className={cn(
                  'text-xl font-extrabold',
                  medioNovo > medioAtual ? 'text-danger' : medioNovo < medioAtual ? 'text-success' : '',
                )}
              >
                {formatCurrency(medioNovo)}
              </strong>
            </p>

            {medioNovo !== medioAtual && (
              <p className="mt-0.5 text-right text-xs text-slate-500 dark:text-slate-400">
                era {formatCurrency(medioAtual)} · {medioNovo > medioAtual ? 'subiu' : 'caiu'}{' '}
                {formatCurrency(Math.abs(medioNovo - medioAtual))}
              </p>
            )}
          </div>
        )}

        {nota == null && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-navy-800 dark:text-slate-400">
            Sem o valor da nota, só a quantidade entra — o custo médio fica como está.
          </p>
        )}

        <Textarea
          label="Observação"
          value={form.notes}
          onChange={(e) => alterar('notes', e.target.value)}
          placeholder="Número da nota, transportadora…"
        />
      </form>
    </Modal>
  );
}
