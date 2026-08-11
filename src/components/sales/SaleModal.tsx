import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useCreateSale } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, PAYMENT_OPTIONS, toInputDate } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { useUnit } from '@/contexts/UnitContext';
import type { Product } from '@/types';
import { AlertTriangle, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

interface SaleModalProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

interface FormState {
  unitId: string;
  customerName: string;
  customerPhone: string;
  quantity: string;
  unitPrice: string;
  paymentMethod: string;
  saleDate: string;
  notes: string;
}

export function SaleModal({ open, onClose, product }: SaleModalProps) {
  const [form, setForm] = useState<FormState>({
    unitId: '',
    customerName: '',
    customerPhone: '',
    quantity: '1',
    unitPrice: '',
    paymentMethod: 'PIX',
    saleDate: toInputDate(new Date()),
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const toast = useToast();
  const createSale = useCreateSale();
  const { unidades } = useUnit();
  const { user } = useAuth();

  /** Vendedor e gerente só vendem da própria unidade. */
  const operaveis =
    user?.role === 'ADMIN' ? unidades : unidades.filter((u) => u.id === user?.unitId);

  useEffect(() => {
    if (!open || !product) return;
    // Já começa na unidade que tem estoque livre, para poupar um clique.
    const comEstoque = product.stock?.find((s) => (s.available ?? s.quantity) > 0);
    setForm({
      unitId: comEstoque?.unitId ?? operaveis[0]?.id ?? '',
      customerName: '',
      customerPhone: '',
      quantity: '1',
      unitPrice: String(product.salePrice || product.wholesalePrice || ''),
      paymentMethod: 'PIX',
      saleDate: toInputDate(new Date()),
      notes: '',
    });
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const set = (field: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const quantity = Number(form.quantity) || 0;
  const linhaDaUnidade = product?.stock?.find((s) => s.unitId === form.unitId);
  // O que está reservado para retirada não pode ser vendido de novo.
  const saldoNaUnidade = linhaDaUnidade?.available ?? linhaDaUnidade?.quantity ?? 0;
  const unitPrice = Number(form.unitPrice) || 0;
  const total = quantity * unitPrice;

  const profit = useMemo(() => {
    if (!product) return 0;
    return total - Number(product.costPrice) * quantity;
  }, [product, total, quantity]);

  const remaining = saldoNaUnidade - quantity;

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (quantity < 1) next.quantity = 'Quantidade mínima: 1';
    if (!form.unitId) next.unitId = 'Selecione a unidade';
    if (form.unitId && quantity > saldoNaUnidade) {
      const nome = unidades.find((u) => u.id === form.unitId)?.name ?? 'unidade';
      next.quantity = `Estoque insuficiente na ${nome}. Disponível: ${saldoNaUnidade}.`;
    }
    if (unitPrice < 0) next.unitPrice = 'Valor inválido';
    if (!form.paymentMethod) next.paymentMethod = 'Selecione a forma de pagamento';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product || !validate()) return;

    try {
      await createSale.mutateAsync({
        productId: product.id,
        unitId: form.unitId,
        customerName: form.customerName.trim() || null,
        customerPhone: form.customerPhone.trim() || null,
        quantity,
        unitPrice,
        paymentMethod: form.paymentMethod,
        saleDate: form.saleDate ? new Date(`${form.saleDate}T12:00:00`).toISOString() : undefined,
        notes: form.notes.trim() || null,
      });

      toast.success(
        'Venda registrada!',
        `${quantity}× ${product.name} · ${formatCurrency(total)} — estoque atualizado.`,
      );
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar venda';

      if (message === 'OFFLINE_QUEUED') {
        toast.warning('Venda salva offline', 'Será enviada assim que a internet voltar.');
        onClose();
        return;
      }
      toast.error('Não foi possível registrar a venda', message);
    }
  }

  if (!product) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar venda"
      description="O estoque será baixado automaticamente"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={createSale.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="sale-form"
            variant="success"
            loading={createSale.isPending}
            icon={<ShoppingCart className="h-4 w-4" />}
          >
            Confirmar venda
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Produto selecionado */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          {product.photos?.[0] ? (
            <img
              src={product.photos[0]}
              alt={product.name}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-400 dark:bg-navy-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-navy-900 dark:text-slate-100">{product.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {[product.brand, product.model, product.capacity, product.color].filter(Boolean).join(' · ')}
            </p>
            {product.imei && (
              <p className="truncate text-[11px] text-slate-400">IMEI: {product.imei}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1">
            {product.stock?.map((s) => (
              <Badge key={s.unitId} tone={s.quantity > 0 ? 'success' : 'danger'}>
                {s.unitName}: {s.quantity}
              </Badge>
            ))}
          </div>
        </div>

        <Select
          label="Unidade da venda"
          required
          value={form.unitId}
          onChange={(e) => set('unitId')(e.target.value)}
          options={operaveis.map((u) => ({
            value: u.id,
            label: (() => {
              const linha = product.stock?.find((s) => s.unitId === u.id);
              const livre = linha?.available ?? linha?.quantity ?? 0;
              const reservadas = linha?.reserved ?? 0;
              return `${u.name} — ${livre} disponível${reservadas ? ` (${reservadas} na loja)` : ''}`;
            })(),
          }))}
          placeholder="Selecione…"
          error={errors.unitId}
          hint="De qual loja o produto está saindo"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Cliente"
            value={form.customerName}
            onChange={(e) => set('customerName')(e.target.value)}
            placeholder="Consumidor"
            hint="Opcional"
            error={errors.customerName}
            autoFocus
          />
          <Input
            label="Telefone"
            value={form.customerPhone}
            onChange={(e) => set('customerPhone')(e.target.value)}
            placeholder="(11) 98888-7777"
            inputMode="tel"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Input
            label="Quantidade"
            required
            type="number"
            min={1}
            max={saldoNaUnidade || undefined}
            value={form.quantity}
            onChange={(e) => set('quantity')(e.target.value)}
            error={errors.quantity}
          />
          <div>
            <Input
              label="Valor unitário"
              required
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice')(e.target.value)}
              error={errors.unitPrice}
            />

            {/* Atalhos: preenchem o valor sem impedir um preço combinado. */}
            {product.wholesalePrice != null && product.salePrice > 0 && (
              <div className="mt-1.5 flex gap-1.5">
                <BotaoDePreco
                  rotulo="Varejo"
                  valor={product.salePrice}
                  escolhido={Number(form.unitPrice) === product.salePrice}
                  aoEscolher={() => set('unitPrice')(String(product.salePrice))}
                />
                <BotaoDePreco
                  rotulo="Atacado"
                  valor={product.wholesalePrice}
                  escolhido={Number(form.unitPrice) === product.wholesalePrice}
                  aoEscolher={() => set('unitPrice')(String(product.wholesalePrice))}
                />
              </div>
            )}
          </div>
          <Select
            label="Forma de pagamento"
            required
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod')(e.target.value)}
            options={PAYMENT_OPTIONS}
            error={errors.paymentMethod}
          />
        </div>

        <Input
          label="Data da venda"
          type="date"
          value={form.saleDate}
          onChange={(e) => set('saleDate')(e.target.value)}
        />

        {/* Resumo */}
        <div className="rounded-xl border border-success/25 bg-success-bg/60 p-4 dark:bg-success/10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-success">Valor total</p>
              <p className="text-2xl font-extrabold text-success">{formatCurrency(total)}</p>
            </div>
            <div className="text-right text-xs text-slate-600 dark:text-slate-400">
              <p>
                Lucro estimado:{' '}
                <strong className={profit >= 0 ? 'text-success' : 'text-danger'}>
                  {formatCurrency(profit)}
                </strong>
              </p>
              <p>
                {unidades.find((u) => u.id === form.unitId)?.name ?? 'Unidade'} após a venda:{' '}
                <strong>{Math.max(0, remaining)} un.</strong>
              </p>
            </div>
          </div>

          {remaining === 0 && quantity > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Esta unidade ficará sem estoque deste produto.
            </p>
          )}
        </div>

        <Textarea
          label="Observações"
          value={form.notes}
          onChange={(e) => set('notes')(e.target.value)}
          placeholder="Garantia, troca, acessórios, condições combinadas…"
        />
      </form>
    </Modal>
  );
}

/** Atalho para preencher o valor com o preço de varejo ou de atacado. */
function BotaoDePreco({
  rotulo,
  valor,
  escolhido,
  aoEscolher,
}: {
  rotulo: string;
  valor: number;
  escolhido: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoEscolher}
      className={cn(
        'flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition',
        escolhido
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
      )}
    >
      {rotulo}
      <span className="block font-normal">{formatCurrency(valor)}</span>
    </button>
  );
}
