import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { CarrinhoDeItens, totalDosItens } from '@/components/vendas/CarrinhoDeItens';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import {
  useAcaoDeCaixa,
  useAtenderPreVenda,
  useCaixaAtual,
  useCancelarPreVenda,
  useCreateSale,
  useFinalizarPreVenda,
  usePreVenda,
  usePreVendas,
  useUsers,
} from '@/hooks/queries';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { caixaService } from '@/services';
import { formatCurrency, formatDateTime, PAYMENT_OPTIONS, PRE_SALE_LABEL } from '@/lib/format';
import type { ItemVenda, PreSale } from '@/types';
import {
  Ban,
  Check,
  DoorClosed,
  DoorOpen,
  FileText,
  Inbox,
  Receipt,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

type Aba = 'pendentes' | 'pdv' | 'fechamento';

/**
 * O que o caixa ainda tem para resolver.
 *
 * Inclui as que já foram abertas: abrir uma pré-venda muda o status, e sem
 * isto ela sumiria da tela justamente na hora de ser atendida.
 */
const FILA_DO_CAIXA = 'AGUARDANDO_CAIXA,EM_ATENDIMENTO';

/**
 * Tela do caixa: recebe as pré-vendas, cobra, finaliza e fecha o dia.
 *
 * É o único lugar do sistema onde uma venda se conclui — e, portanto, o
 * único onde o estoque baixa por venda.
 */
export default function CaixaPage() {
  const [aba, setAba] = useState<Aba>('pendentes');
  const { data: caixa } = useCaixaAtual();
  const { data: preVendas } = usePreVendas({ status: FILA_DO_CAIXA });

  // Uma pré-venda já aberta continua sendo trabalho por fazer.
  const pendentes = preVendas?.meta.total ?? 0;

  const abas = [
    { chave: 'pendentes' as const, rotulo: 'Pré-vendas', icone: Inbox, contador: pendentes },
    { chave: 'pdv' as const, rotulo: 'Nova venda', icone: ShoppingBag },
    { chave: 'fechamento' as const, rotulo: 'Fechamento', icone: Receipt },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            🧾 Caixa
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {caixa?.aberto
              ? `Caixa ${caixa.turno?.code} aberto desde ${formatDateTime(caixa.turno?.openedAt ?? '')}`
              : 'Abra o caixa para começar a registrar vendas'}
          </p>
        </div>
        <ControleDoTurno />
      </div>

      {!caixa?.aberto && (
        <Card className="border-warning/40 bg-warning-bg/40 dark:bg-warning/10">
          <CardBody className="text-sm text-warning">
            O caixa está fechado. Você ainda consegue finalizar vendas, mas elas não entram em nenhum
            fechamento — abra o caixa para que o relatório do dia saia certo.
          </CardBody>
        </Card>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-navy-700">
        {abas.map((item) => (
          <button
            key={item.chave}
            type="button"
            onClick={() => setAba(item.chave)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              aba === item.chave
                ? 'border-accent text-accent'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-navy-900 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <item.icone className="h-4 w-4" />
            {item.rotulo}
            {item.contador ? (
              <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                {item.contador}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {aba === 'pendentes' && <FilaDePreVendas />}
      {aba === 'pdv' && <VendaDireta />}
      {aba === 'fechamento' && <Fechamento />}
    </div>
  );
}

// ------------------------------------------------------------ Turno do caixa

function ControleDoTurno() {
  const { data: caixa } = useCaixaAtual();
  const { unidades } = useUnit();
  const toast = useToast();

  const abrir = useAcaoDeCaixa((v: { unitId?: string }) => caixaService.abrir(v));
  const fechar = useAcaoDeCaixa((notes?: string) => caixaService.fechar(notes));

  async function alternar() {
    try {
      if (caixa?.aberto) {
        const r = await fechar.mutateAsync(undefined);
        toast.success('Caixa fechado', r.message);
      } else {
        const r = await abrir.mutateAsync({ unitId: unidades[0]?.id });
        toast.success('Caixa aberto', r.message);
      }
    } catch (erro) {
      toast.error('Não foi possível', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Button
      variant={caixa?.aberto ? 'outline' : 'primary'}
      loading={abrir.isPending || fechar.isPending}
      onClick={() => void alternar()}
      icon={caixa?.aberto ? <DoorClosed className="h-4 w-4" /> : <DoorOpen className="h-4 w-4" />}
    >
      {caixa?.aberto ? 'Fechar caixa' : 'Abrir caixa'}
    </Button>
  );
}

// ---------------------------------------------------------- Fila de pedidos

function FilaDePreVendas() {
  const { data, isLoading } = usePreVendas({ status: FILA_DO_CAIXA });
  const [abrindo, setAbrindo] = useState<PreSale | null>(null);

  const lista = data?.data ?? [];

  return (
    <>
      {isLoading && <div className="skeleton h-32 w-full" />}

      {!isLoading && lista.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Inbox className="h-10 w-10 text-slate-300 dark:text-navy-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma pré-venda aguardando. Quando um vendedor enviar, aparece aqui.
            </p>
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
                    {pv.seller?.name} · {formatDateTime(pv.createdAt)}
                  </p>
                </div>
                <Badge tone={pv.status === 'EM_ATENDIMENTO' ? 'info' : 'warning'}>
                  {PRE_SALE_LABEL[pv.status]}
                </Badge>
              </div>

              <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-navy-700">
                {pv.items.map((i) => (
                  <p key={i.id} className="flex justify-between text-sm">
                    <span className="truncate text-slate-600 dark:text-slate-400">
                      {i.quantity}× {i.productName}
                    </span>
                    <span className="shrink-0 font-medium">{formatCurrency(i.unitPrice * i.quantity)}</span>
                  </p>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
                <span className="text-lg font-extrabold text-success">
                  {formatCurrency(pv.totalAmount)}
                </span>
                <Button size="sm" onClick={() => setAbrindo(pv)}>
                  {pv.status === 'EM_ATENDIMENTO' ? 'Continuar' : 'Abrir pré-venda'}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <ConferenciaDaPreVenda preVenda={abrindo} aoFechar={() => setAbrindo(null)} />
    </>
  );
}

/** Conferência item a item antes de finalizar. */
function ConferenciaDaPreVenda({
  preVenda,
  aoFechar,
}: {
  preVenda: PreSale | null;
  aoFechar: () => void;
}) {
  const { unidades } = useUnit();
  const toast = useToast();

  const { data: detalhe } = usePreVenda(preVenda?.id);
  const atender = useAtenderPreVenda();
  const finalizar = useFinalizarPreVenda();
  const cancelar = useCancelarPreVenda();

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [form, setForm] = useState({ unitId: '', paymentMethod: 'PIX', installments: '1', notes: '' });

  // Assume o atendimento ao abrir: evita dois caixas na mesma pré-venda.
  useEffect(() => {
    if (!preVenda) return;
    void atender.mutateAsync(preVenda.id).catch((erro: Error) => toast.warning('Atenção', erro.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preVenda?.id]);

  useEffect(() => {
    if (!detalhe) return;
    setItens(detalhe.items);
    setForm({
      unitId: detalhe.unit?.id ?? unidades[0]?.id ?? '',
      paymentMethod: detalhe.paymentMethod ?? 'PIX',
      installments: String(detalhe.installments ?? 1),
      notes: detalhe.notes ?? '',
    });
  }, [detalhe, unidades]);

  if (!preVenda) return null;

  const semSaldo = itens.some((i) => i.disponivel != null && i.quantity > i.disponivel);

  async function confirmar() {
    try {
      const r = await finalizar.mutateAsync({
        id: preVenda!.id,
        dados: {
          unitId: form.unitId,
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
        },
      });
      toast.success('Venda finalizada', r.message);
      setConfirmando(false);
      aoFechar();
    } catch (erro) {
      setConfirmando(false);
      toast.error('Não foi possível finalizar', erro instanceof Error ? erro.message : undefined);
    }
  }

  async function recusar() {
    try {
      const r = await cancelar.mutateAsync({ id: preVenda!.id, motivo: 'Cancelada no caixa' });
      toast.success('Pré-venda cancelada', r.message);
      aoFechar();
    } catch (erro) {
      toast.error('Não foi possível cancelar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={aoFechar}
        title={`Conferir ${preVenda.code}`}
        description={`${preVenda.customerName} · vendedor: ${preVenda.seller?.name ?? '—'}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" className="text-danger" onClick={() => void recusar()} icon={<Ban className="h-4 w-4" />}>
              Cancelar pré-venda
            </Button>
            <Button variant="secondary" onClick={aoFechar}>
              Voltar
            </Button>
            <Button
              variant="success"
              onClick={() => setConfirmando(true)}
              disabled={!itens.length || !form.unitId}
              icon={<Check className="h-4 w-4" />}
            >
              Finalizar venda
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-navy-800 sm:grid-cols-3">
            <p>
              <span className="block text-xs text-slate-500">Cliente</span>
              <strong className="text-navy-900 dark:text-slate-100">{preVenda.customerName}</strong>
            </p>
            <p>
              <span className="block text-xs text-slate-500">CPF</span>
              <strong className="text-navy-900 dark:text-slate-100">
                {preVenda.customerDocument ?? '—'}
              </strong>
            </p>
            <p>
              <span className="block text-xs text-slate-500">Telefone</span>
              <strong className="text-navy-900 dark:text-slate-100">
                {preVenda.customerPhone ?? '—'}
              </strong>
            </p>
          </div>

          <CarrinhoDeItens itens={itens} aoMudar={setItens} unidadeId={form.unitId} />

          {semSaldo && (
            <p className="rounded-lg bg-danger-bg px-4 py-2.5 text-sm font-semibold text-danger dark:bg-danger/10">
              Um dos itens não tem saldo suficiente na unidade escolhida. Ajuste a quantidade ou a
              unidade antes de finalizar.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Unidade de saída"
              required
              value={form.unitId}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
              hint="De onde o produto sai"
            />
            <Select
              label="Forma de pagamento"
              required
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
          </div>

          <Textarea
            label="Observação"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        title="Confirmar venda?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmando(false)}>
              Voltar
            </Button>
            <Button variant="success" loading={finalizar.isPending} onClick={() => void confirmar()}>
              Sim, finalizar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            O estoque será atualizado após a confirmação.
          </p>
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-navy-800">
            <p className="flex justify-between">
              <span>Itens</span>
              <strong>{itens.reduce((n, i) => n + i.quantity, 0)}</strong>
            </p>
            <p className="flex justify-between">
              <span>Sai de</span>
              <strong>{unidades.find((u) => u.id === form.unitId)?.name ?? '—'}</strong>
            </p>
            <p className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-base dark:border-navy-700">
              <span>Total</span>
              <strong className="text-success">{formatCurrency(totalDosItens(itens))}</strong>
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

// -------------------------------------------------------------- PDV direto

function VendaDireta() {
  const { unidades } = useUnit();
  const { user } = useAuth();
  const toast = useToast();
  const criar = useCreateSale();
  const { data: usuarios } = useUsers({ pageSize: 100 }, true);

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    unitId: '',
    paymentMethod: 'PIX',
    installments: '1',
    sellerId: '',
    notes: '',
  });

  const unidade = form.unitId || unidades[0]?.id || '';
  const vendedores = (usuarios?.data ?? []).filter((u) => u.role === 'VENDEDOR' || u.role === 'CAIXA');

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (form.customerName.trim().length < 2) return toast.warning('Informe o nome do cliente');
    if (!itens.length) return toast.warning('Adicione ao menos um produto');

    try {
      await criar.mutateAsync({
        items: itens.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          imei: i.imei || null,
          serialNumber: i.serialNumber || null,
        })),
        unitId: unidade,
        paymentMethod: form.paymentMethod,
        installments: Number(form.installments) || 1,
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || null,
        customerDocument: form.customerDocument.trim() || null,
        sellerId: form.sellerId || user?.id,
        notes: form.notes.trim() || null,
      });

      toast.success('Venda registrada', 'Estoque atualizado e movimentação gerada.');
      setItens([]);
      setForm((f) => ({ ...f, customerName: '', customerPhone: '', customerDocument: '', notes: '' }));
    } catch (erro) {
      const m = erro instanceof Error ? erro.message : 'Erro ao registrar';
      if (m === 'OFFLINE_QUEUED') {
        toast.warning('Salva offline', 'Será enviada quando a internet voltar.');
        return;
      }
      toast.error('Não foi possível registrar', m);
    }
  }

  return (
    <Card>
      <CardHeader title="Nova venda no balcão" subtitle="Sem passar por pré-venda" />
      <CardBody>
        <form onSubmit={enviar} className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Cliente"
              required
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
            />
            <Input
              label="CPF"
              value={form.customerDocument}
              onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
            />
            <Input
              label="Telefone"
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
            />
          </div>

          <CarrinhoDeItens itens={itens} aoMudar={setItens} unidadeId={unidade} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Select
              label="Unidade de saída"
              required
              value={unidade}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
            />
            <Select
              label="Forma de pagamento"
              required
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
              label="Vendedor"
              value={form.sellerId}
              onChange={(e) => setForm((f) => ({ ...f, sellerId: e.target.value }))}
              options={vendedores.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Eu mesmo"
              hint="Para a comissão"
            />
          </div>

          <Textarea
            label="Observação"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <Button
            type="submit"
            variant="success"
            loading={criar.isPending}
            disabled={!itens.length}
            icon={<Check className="h-4 w-4" />}
          >
            Finalizar venda · {formatCurrency(totalDosItens(itens))}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------- Fechamento

function Fechamento() {
  const { data: caixa } = useCaixaAtual();
  const toast = useToast();
  const resumo = caixa?.resumo;

  async function baixar(formato: 'pdf' | 'xlsx' | 'csv') {
    if (!caixa?.turno) return;
    try {
      await downloadFile(`/cash/${caixa.turno.id}/relatorio`, { format: formato }, `caixa.${formato}`);
      toast.success('Relatório gerado');
    } catch {
      toast.error('Não foi possível gerar o relatório');
    }
  }

  if (!caixa?.aberto || !resumo) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <Receipt className="h-10 w-10 text-slate-300 dark:text-navy-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Abra o caixa para acompanhar o fechamento do dia.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vendas" value={resumo.quantidadeDeVendas} icon={Receipt} tone="navy" />
        <StatCard label="Produtos vendidos" value={resumo.itensVendidos} icon={ShoppingBag} tone="accent" />
        <StatCard label="Total do caixa" value={formatCurrency(resumo.total)} icon={TrendingUp} tone="success" />
        <StatCard
          label="Ticket médio"
          value={formatCurrency(resumo.ticketMedio)}
          hint={`Lucro estimado: ${formatCurrency(resumo.lucro)}`}
          icon={TrendingUp}
          tone="purple"
        />
      </div>

      <Card>
        <CardHeader
          title="Por forma de pagamento"
          subtitle={`Caixa ${caixa.turno?.code}`}
          action={
            <div className="flex gap-1.5">
              {(['pdf', 'xlsx', 'csv'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant="outline"
                  onClick={() => void baixar(f)}
                  icon={<FileText className="h-3.5 w-3.5" />}
                >
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          }
        />
        <CardBody className="space-y-2">
          {resumo.porPagamento.map((p) => (
            <div
              key={p.forma}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                p.quantidade > 0
                  ? 'bg-slate-50 dark:bg-navy-800'
                  : 'text-slate-400 dark:text-navy-600',
              )}
            >
              <span className="font-medium">{p.rotulo}</span>
              <span>
                {p.quantidade > 0 && (
                  <span className="mr-3 text-xs text-slate-500">{p.quantidade} venda(s)</span>
                )}
                <strong className={p.quantidade > 0 ? 'text-navy-900 dark:text-slate-100' : ''}>
                  {formatCurrency(p.total)}
                </strong>
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg bg-navy-900 px-4 py-3 text-white dark:bg-navy-950">
            <span className="font-semibold">TOTAL GERAL</span>
            <span className="text-xl font-extrabold">{formatCurrency(resumo.total)}</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
