import { FormularioDeTroca } from '@/components/trocas/FormularioDeTroca';
import { EscudoImei } from '@/pages/TrocasPage';
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
import { useCriarPreVenda, useDesistirPreVenda, usePreVendas, useTrocas, useUnidadeDeVenda } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDateTime, PAYMENT_OPTIONS, PRE_SALE_LABEL } from '@/lib/format';
import type { ItemVenda, PreSale, PreSaleStatus, Troca } from '@/types';
import { Clock, Plus, Repeat2, Send, ShoppingCart, X } from 'lucide-react';
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
  const { data: unidadeDeVenda } = useUnidadeDeVenda();
  const toast = useToast();
  const criar = useCriarPreVenda();

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [troca, setTroca] = useState<Troca | null>(null);
  const [trocaAberta, setTrocaAberta] = useState(false);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    unitId: user?.unitId ?? '',
    paymentMethod: 'PIX',
    installments: '1',
    notes: '',
  });

  // A pré-venda aponta para a mesma unidade de onde a venda vai sair,
  // senão o vendedor veria o saldo de um estoque e o caixa baixaria de outro.
  const unidadeEscolhida = unidadeDeVenda?.unitId || form.unitId || unidades[0]?.id || '';

  // Só trocas que ainda não estão em outro pedido.
  const { data: trocasLivres } = useTrocas({ livres: 'true' });
  const disponiveis = trocasLivres?.data ?? [];

  const bruto = totalDosItens(itens);
  const abatimento = troca?.valorAvaliado ?? 0;
  const aPagar = Math.max(0, bruto - abatimento);

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
        tradeInId: troca?.id ?? null,
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
      setTroca(null);
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
          <p className="label-base">Troca de aparelho</p>

          {troca ? (
            <div className="rounded-lg border border-accent bg-accent/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{troca.code}</p>
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-slate-100">
                    {troca.modelo}
                    {troca.armazenamento ? ` ${troca.armazenamento}` : ''}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                    IMEI {troca.imei}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <EscudoImei situacao={troca.imeiSituacao} compacto />
                  <button
                    type="button"
                    onClick={() => setTroca(null)}
                    className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                    aria-label="Tirar a troca do pedido"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="mt-2 flex items-center justify-between border-t border-accent/20 pt-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Abate do pedido</span>
                <strong className="text-success">− {formatCurrency(troca.valorAvaliado)}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setTrocaAberta(true)}
                icon={<Repeat2 className="h-4 w-4" />}
              >
                O cliente vai dar um aparelho na troca
              </Button>

              {disponiveis.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                    Ou use uma troca já avaliada:
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
                    {disponiveis.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTroca(t)}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-navy-900 dark:text-slate-100">
                          {t.code} · {t.modelo} · {t.customerName}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-success">
                          {formatCurrency(t.valorAvaliado)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
            {/* A loja vende de um ponto só: mostrar basta, e escolher seria
                mais um campo para errar. Muda em Configurações. */}
            <div>
              <p className="label-base">Sai do estoque de</p>
              <p className="flex h-[42px] items-center rounded-lg bg-slate-50 px-3 text-sm font-semibold text-navy-900 dark:bg-navy-800 dark:text-slate-100">
                {unidadeDeVenda?.name ?? unidades.find((u) => u.id === unidadeEscolhida)?.name ?? 'carregando…'}
              </p>
            </div>
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
          avisar na hora de finalizar.
        </p>

        <div className="rounded-lg bg-navy-900 px-4 py-3 text-white dark:bg-navy-800">
          <p className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Aparelhos</span>
            <span>{formatCurrency(bruto)}</span>
          </p>
          {troca && (
            <p className="mt-1 flex items-center justify-between text-sm">
              <span className="text-slate-300">Troca {troca.code}</span>
              <span className="text-success-soft">− {formatCurrency(abatimento)}</span>
            </p>
          )}
          <p className="mt-2 flex items-center justify-between border-t border-white/15 pt-2">
            <span className="font-semibold">
              {troca ? 'O cliente ainda paga' : 'Total do pedido'}
            </span>
            <strong className="text-2xl font-extrabold">{formatCurrency(aPagar)}</strong>
          </p>
        </div>
      </form>

      <FormularioDeTroca
        aberto={trocaAberta}
        aoFechar={() => setTrocaAberta(false)}
        aoCriar={setTroca}
      />
    </Modal>
  );
}
