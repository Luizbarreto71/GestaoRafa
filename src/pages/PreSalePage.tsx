import { CarrinhoDeItens, totalDosItens } from '@/components/vendas/CarrinhoDeItens';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useCriarPreVenda, useDesistirPreVenda, usePreVendas } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateTime, PAYMENT_OPTIONS, PRE_SALE_LABEL } from '@/lib/format';
import type { ItemVenda, PreSale, PreSaleStatus } from '@/types';
import { Clock, Plus, Send, ShoppingCart, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

const TOM: Record<PreSaleStatus, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  AGUARDANDO_CAIXA: 'warning',
  EM_ATENDIMENTO: 'info',
  FINALIZADA: 'success',
  CANCELADA: 'danger',
  EXPIRADA: 'neutral',
};

/**
 * Tela do vendedor: monta a pré-venda e acompanha as suas.
 *
 * Nada aqui mexe no estoque — a pré-venda é só a intenção de venda. Quem
 * baixa é o caixa, ao confirmar que o cliente pagou.
 */
export default function PreSalePage() {
  const [formAberto, setFormAberto] = useState(false);
  const [detalhe, setDetalhe] = useState<PreSale | null>(null);
  const [desistindo, setDesistindo] = useState<PreSale | null>(null);

  const toast = useToast();
  const { data, isLoading } = usePreVendas({});
  const desistir = useDesistirPreVenda();

  async function confirmarDesistencia() {
    if (!desistindo) return;
    try {
      const r = await desistir.mutateAsync(desistindo.id);
      toast.success('Pré-venda cancelada', r.message);
      setDesistindo(null);
    } catch (erro) {
      toast.error('Não foi possível cancelar', erro instanceof Error ? erro.message : undefined);
    }
  }

  const lista = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            🛒 Minhas pré-vendas
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Monte o pedido e envie ao caixa. O estoque só baixa quando o caixa finalizar.
          </p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormAberto(true)}>
          Nova pré-venda
        </Button>
      </div>

      {isLoading && <div className="skeleton h-32 w-full" />}

      {!isLoading && lista.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-slate-300 dark:text-navy-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Você ainda não criou nenhuma pré-venda.
            </p>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setFormAberto(true)}>
              Criar a primeira
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {lista.map((pv) => (
          <Card key={pv.id}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{pv.code}</p>
                  <p className="truncate text-base font-bold text-navy-900 dark:text-slate-100">
                    {pv.customerName}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(pv.createdAt)}
                    {pv.unit ? ` · ${pv.unit.name}` : ''}
                  </p>
                </div>
                <Badge tone={TOM[pv.status]}>{PRE_SALE_LABEL[pv.status]}</Badge>
              </div>

              <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-navy-700">
                {pv.items.map((item) => (
                  <p key={item.id} className="flex justify-between text-sm">
                    <span className="truncate text-slate-600 dark:text-slate-400">
                      {item.quantity}× {item.productName}
                    </span>
                    <span className="shrink-0 font-medium text-navy-900 dark:text-slate-200">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
                <span className="text-lg font-extrabold text-success">
                  {formatCurrency(pv.totalAmount)}
                </span>

                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setDetalhe(pv)}>
                    Detalhes
                  </Button>
                  {pv.status === 'AGUARDANDO_CAIXA' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => setDesistindo(pv)}
                      icon={<X className="h-3.5 w-3.5" />}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>

              {pv.status === 'AGUARDANDO_CAIXA' && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <Clock className="h-3.5 w-3.5" />O caixa ainda não abriu este pedido
                </p>
              )}
              {pv.status === 'FINALIZADA' && pv.sale && (
                <p className="text-xs font-semibold text-success">
                  ✅ Virou a venda {pv.sale.code}
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <FormularioDePreVenda aberto={formAberto} aoFechar={() => setFormAberto(false)} />

      <Modal
        open={Boolean(detalhe)}
        onClose={() => setDetalhe(null)}
        title={detalhe?.code}
        description={detalhe ? PRE_SALE_LABEL[detalhe.status] : undefined}
        size="sm"
      >
        {detalhe && (
          <div className="space-y-4 text-sm">
            <Linha rotulo="Cliente" valor={detalhe.customerName} />
            <Linha rotulo="Telefone" valor={detalhe.customerPhone ?? '—'} />
            <Linha rotulo="CPF" valor={detalhe.customerDocument ?? '—'} />
            <Linha rotulo="Pagamento" valor={detalhe.paymentMethod ?? 'a definir no caixa'} />
            <Linha rotulo="Parcelas" valor={String(detalhe.installments)} />
            {detalhe.cashier && <Linha rotulo="Caixa" valor={detalhe.cashier.name} />}
            {detalhe.notes && <Linha rotulo="Observação" valor={detalhe.notes} />}
            <CarrinhoDeItens itens={detalhe.items} aoMudar={() => {}} somenteLeitura />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(desistindo)}
        title="Cancelar pré-venda"
        message={`A pré-venda ${desistindo?.code} some da fila do caixa. Nenhum estoque foi movimentado.`}
        confirmLabel="Cancelar pré-venda"
        cancelLabel="Voltar"
        loading={desistir.isPending}
        onConfirm={() => void confirmarDesistencia()}
        onCancel={() => setDesistindo(null)}
      />
    </div>
  );
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <p className="flex justify-between gap-3">
    <span className="text-slate-500 dark:text-slate-400">{rotulo}</span>
    <span className="text-right font-medium text-navy-900 dark:text-slate-100">{valor}</span>
  </p>
);

/** Formulário de uma pré-venda nova. */
function FormularioDePreVenda({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { user } = useAuth();
  const { unidades } = useUnit();
  const toast = useToast();
  const criar = useCriarPreVenda();

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    unitId: user?.unitId ?? '',
    paymentMethod: 'PIX',
    installments: '1',
    notes: '',
  });

  const unidadeEscolhida = form.unitId || unidades[0]?.id || '';

  async function enviar(evento: FormEvent) {
    evento.preventDefault();

    if (form.customerName.trim().length < 2) return toast.warning('Informe o nome do cliente');
    if (!itens.length) return toast.warning('Adicione ao menos um produto');

    try {
      const r = await criar.mutateAsync({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || null,
        customerDocument: form.customerDocument.trim() || null,
        unitId: unidadeEscolhida || null,
        paymentMethod: form.paymentMethod,
        installments: Number(form.installments) || 1,
        notes: form.notes.trim() || null,
        items: itens.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          imei: i.imei || null,
          serialNumber: i.serialNumber || null,
        })),
      });

      toast.success('Enviada ao caixa', r.message);
      setItens([]);
      setForm((f) => ({ ...f, customerName: '', customerPhone: '', customerDocument: '', notes: '' }));
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível enviar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Nova pré-venda"
      description="O caixa recebe o pedido e finaliza quando o cliente pagar"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-prevenda"
            loading={criar.isPending}
            icon={<Send className="h-4 w-4" />}
          >
            Enviar para o caixa
          </Button>
        </>
      }
    >
      <form id="form-prevenda" onSubmit={enviar} className="space-y-5">
        <div>
          <p className="label-base">Cliente</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nome"
              required
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              autoFocus
            />
            <Input
              label="CPF"
              value={form.customerDocument}
              onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
              placeholder="000.000.000-00"
            />
            <Input
              label="Telefone"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="(11) 90000-0000"
            />
          </div>
        </div>

        <div>
          <p className="label-base">Produtos</p>
          <CarrinhoDeItens itens={itens} aoMudar={setItens} unidadeId={unidadeEscolhida} />
        </div>

        <div>
          <p className="label-base">Pagamento</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Forma"
              value={form.paymentMethod}
              onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              options={PAYMENT_OPTIONS}
            />
            <Input
              label="Parcelas"
              type="number"
              min={1}
              max={24}
              value={form.installments}
              onChange={(e) => setForm((f) => ({ ...f, installments: e.target.value }))}
            />
            <Select
              label="Unidade"
              value={unidadeEscolhida}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
              hint="De onde o produto sai"
            />
          </div>
        </div>

        <Textarea
          label="Observação"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Combinações, troca, garantia…"
        />

        <p
          className={cn(
            'rounded-lg px-4 py-2.5 text-xs leading-relaxed',
            'bg-warning-bg/60 text-warning dark:bg-warning/10',
          )}
        >
          O estoque <strong>não</strong> é reservado agora. Se outra pessoa vender antes, o caixa vai
          avisar na hora de finalizar. Total do pedido: <strong>{formatCurrency(totalDosItens(itens))}</strong>
        </p>
      </form>
    </Modal>
  );
}
