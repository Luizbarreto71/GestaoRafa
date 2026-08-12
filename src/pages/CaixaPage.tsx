import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { CarrinhoDeItens, totalDosItens } from '@/components/vendas/CarrinhoDeItens';
import { ReciboDaVenda } from '@/components/vendas/ReciboDaVenda';
import {
  TrocaNoBalcao,
  trocaParaApi,
  trocaVazia,
  type TrocaDeBalcao,
} from '@/components/vendas/TrocaNoBalcao';
import {
  FormasDePagamento,
  paraApi,
  somaDasFormas,
  type FormaDePagamento,
} from '@/components/vendas/FormasDePagamento';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import {
  useAcaoDeCaixa,
  useAtenderPreVenda,
  useCaixaAtual,
  useCancelarPreVenda,
  useContasDePix,
  useCreateSale,
  useFinalizarPreVenda,
  usePreVenda,
  usePreVendas,
  useUnidadeDeVenda,
  useUsers,
} from '@/hooks/queries';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFEITO_ROTULO, SITUACAO_IMEI_ROTULO } from '@shared/trocas';
import { caixaService } from '@/services';
import { formatCurrency, formatDateTime, PRE_SALE_LABEL } from '@/lib/format';
import type { ItemVenda, PreSale } from '@/types';
import {
  Ban,
  Check,
  DoorClosed,
  DoorOpen,
  FileText,
  Inbox,
  Receipt,
  Repeat2,
  ShoppingBag,
  Store,
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
  // Fica aqui, e não na conferência: aquela tela some ao finalizar.
  const [recibo, setRecibo] = useState<{ id: string; code: string; totalAmount: number } | null>(null);

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

              {pv.tradeIn && (
                <div className="flex items-center gap-2 rounded-lg bg-accent/5 px-2.5 py-1.5 text-xs">
                  <Repeat2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-400">
                    Troca {pv.tradeIn.code} · {pv.tradeIn.modelo}
                  </span>
                  <span className="shrink-0 font-semibold text-success">
                    − {formatCurrency(pv.tradeIn.valorAvaliado)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-navy-700">
                <div>
                  {pv.tradeIn && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">já com a troca abatida</p>
                  )}
                  <span className="text-lg font-extrabold text-success">
                    {formatCurrency(pv.totalAmount)}
                  </span>
                </div>
                <Button size="sm" onClick={() => setAbrindo(pv)}>
                  {pv.status === 'EM_ATENDIMENTO' ? 'Continuar' : 'Abrir pré-venda'}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <ConferenciaDaPreVenda
        preVenda={abrindo}
        aoFechar={() => setAbrindo(null)}
        aoFinalizar={setRecibo}
      />

      <ReciboDaVenda venda={recibo} aoFechar={() => setRecibo(null)} />
    </>
  );
}

/** Conferência item a item antes de finalizar. */
function ConferenciaDaPreVenda({
  preVenda,
  aoFechar,
  aoFinalizar,
}: {
  preVenda: PreSale | null;
  aoFechar: () => void;
  aoFinalizar: (venda: { id: string; code: string; totalAmount: number }) => void;
}) {
  const { unidades } = useUnit();
  const { data: unidadeDeVenda } = useUnidadeDeVenda();
  const toast = useToast();

  const { data: detalhe } = usePreVenda(preVenda?.id);
  const atender = useAtenderPreVenda();
  const finalizar = useFinalizarPreVenda();
  const cancelar = useCancelarPreVenda();

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [dividido, setDividido] = useState(false);
  const [formas, setFormas] = useState<FormaDePagamento[]>([]);
  const [form, setForm] = useState({ unitId: '', paymentMethod: 'PIX', installments: '1', notes: '' });

  // O que o cliente paga: os itens menos a troca que ele entregou.
  const totalAReceber = Math.max(
    0,
    totalDosItens(itens) - Number(detalhe?.tradeIn?.valorAvaliado ?? 0),
  );

  // Assume o atendimento ao abrir: evita dois caixas na mesma pré-venda.
  useEffect(() => {
    if (!preVenda) return;
    void atender.mutateAsync(preVenda.id).catch((erro: Error) => toast.warning('Atenção', erro.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preVenda?.id]);

  useEffect(() => {
    if (!detalhe) return;

    // Traz foto e características para o carrinho: é aqui que o caixa
    // confere item a item o que o vendedor montou.
    setItens(
      detalhe.items.map((i) => ({
        ...i,
        foto: i.product?.photos?.[0] ? `/api/fotos/${i.product.photos[0].id}` : null,
        detalhes: [i.product?.brand, i.product?.capacity, i.product?.color, i.product?.condicao]
          .filter(Boolean)
          .join(' · '),
      })),
    );
    setForm({
      // Mesma regra do balcão: a venda sai da unidade configurada, mesmo
      // que o vendedor tenha sugerido outra na pré-venda.
      unitId: unidadeDeVenda?.unitId ?? '',
      paymentMethod: detalhe.paymentMethod ?? 'PIX',
      installments: String(detalhe.installments ?? 1),
      notes: detalhe.notes ?? '',
    });
    // A unidade entra nas dependências: ela chega do servidor e pode
    // demorar mais que a pré-venda.
  }, [detalhe, unidades, unidadeDeVenda]);

  if (!preVenda) return null;

  const semSaldo = itens.some((i) => i.disponivel != null && i.quantity > i.disponivel);

  async function confirmar() {
    if (dividido && Math.abs(somaDasFormas(formas) - totalAReceber) >= 0.01) {
      setConfirmando(false);
      return toast.warning(
        'As formas não fecham com o total',
        'Ajuste os valores até não sobrar nem faltar.',
      );
    }

    try {
      const r = await finalizar.mutateAsync({
        id: preVenda!.id,
        dados: {
          unitId: form.unitId,
          paymentMethod: form.paymentMethod,
          installments: Number(form.installments) || 1,
          payments: paraApi(dividido, formas),
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

      if (r.sale?.id) {
        aoFinalizar({ id: r.sale.id, code: r.sale.code, totalAmount: Number(r.sale.totalAmount) });
      }
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

          {/* A troca muda o que se cobra: precisa estar à vista do caixa. */}
          {detalhe?.tradeIn && (
            <div className="rounded-lg border border-accent bg-accent/5 p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-slate-100">
                <Repeat2 className="h-4 w-4 text-accent" />
                Troca {detalhe.tradeIn.code}
              </p>

              <div className="mt-1.5 space-y-1 text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Aparelho recebido</span>
                  <span className="text-right font-medium text-navy-900 dark:text-slate-100">
                    {detalhe.tradeIn.modelo}
                    {detalhe.tradeIn.estado ? ` · ${detalhe.tradeIn.estado}` : ''}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">IMEI</span>
                  <span className="font-mono text-xs text-navy-900 dark:text-slate-100">
                    {detalhe.tradeIn.imei}
                  </span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Anatel</span>
                  <span
                    className={cn(
                      'font-semibold',
                      detalhe.tradeIn.imeiSituacao === 'REGULAR'
                        ? 'text-success'
                        : detalhe.tradeIn.imeiSituacao === 'BLOQUEADO'
                          ? 'text-danger'
                          : 'text-warning',
                    )}
                  >
                    {SITUACAO_IMEI_ROTULO[detalhe.tradeIn.imeiSituacao] ?? detalhe.tradeIn.imeiSituacao}
                  </span>
                </p>
              </div>

              {detalhe.tradeIn.defeitos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detalhe.tradeIn.defeitos.map((d) => (
                    <span
                      key={d}
                      className="rounded bg-warning-bg px-1.5 py-0.5 text-[11px] font-medium text-warning dark:bg-warning/15"
                    >
                      {DEFEITO_ROTULO[d] ?? d}
                    </span>
                  ))}
                </div>
              )}

              {detalhe.tradeIn.imeiSituacao === 'NAO_CONSULTADO' && (
                <p className="mt-2 text-xs font-semibold text-warning">
                  ⚠ Ninguém consultou este IMEI na Anatel. Confira antes de fechar.
                </p>
              )}

              <p className="mt-2 flex items-center justify-between border-t border-accent/20 pt-2">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Abatido do que o cliente paga
                </span>
                <strong className="text-success">
                  − {formatCurrency(detalhe.tradeIn.valorAvaliado)}
                </strong>
              </p>
            </div>
          )}

          {semSaldo && (
            <p className="rounded-lg bg-danger-bg px-4 py-2.5 text-sm font-semibold text-danger dark:bg-danger/10">
              Um dos itens não tem saldo suficiente na unidade escolhida. Ajuste a quantidade ou a
              unidade antes de finalizar.
            </p>
          )}

          <div>
            <p className="label-base">Sai do estoque de</p>
            <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-navy-900 dark:bg-navy-800 dark:text-slate-100">
              <Store className="h-4 w-4 text-slate-400" />
              {unidades.find((u) => u.id === form.unitId)?.name ?? 'carregando…'}
            </p>
          </div>

          <FormasDePagamento
            dividido={dividido}
            aoDividir={setDividido}
            formas={formas}
            aoMudarFormas={setFormas}
            formaUnica={form.paymentMethod}
            aoMudarFormaUnica={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
            parcelas={form.installments}
            aoMudarParcelas={(v) => setForm((f) => ({ ...f, installments: v }))}
            total={totalAReceber}
          />

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
  const { data: unidadeDeVenda } = useUnidadeDeVenda();
  const contasPix = useContasDePix();

  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [recibo, setRecibo] = useState<{ id: string; code: string; totalAmount: number } | null>(null);
  const [comTroca, setComTroca] = useState(false);
  const [troca, setTroca] = useState<TrocaDeBalcao>(trocaVazia);
  const [dividido, setDividido] = useState(false);
  const [formas, setFormas] = useState<FormaDePagamento[]>([]);
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerDocument: '',
    unitId: '',
    paymentMethod: 'PIX',
    destino: '',
    installments: '1',
    entrada: '',
    formaDaEntrada: 'PIX',
    vendedor: '',
    notes: '',
  });

  /**
   * Entrada mais saldo devedor, quando a venda sai fiada.
   *
   * Vira duas linhas: o que o cliente adiantou na forma escolhida e o
   * resto em aberto. Sem entrada, uma linha só.
   */
  function pagamentoEmAberto() {
    if (form.paymentMethod !== 'EM_ABERTO') return undefined;

    const pago = Number(form.entrada) || 0;
    const resto = Math.max(0, total - pago);

    return [
      ...(pago > 0
        ? [{ method: form.formaDaEntrada, amount: pago, installments: 1, notes: null }]
        : []),
      ...(resto > 0 ? [{ method: 'EM_ABERTO', amount: resto, installments: 1, notes: null }] : []),
    ];
  }

  // A venda sai sempre da unidade configurada; o caixa não escolhe.
  //
  // Sem cair na primeira da lista enquanto carrega: por um instante a tela
  // mostraria outra loja, e quem finaliza rápido tiraria a peça do estoque
  // errado. Melhor segurar o botão por meio segundo.
  const unidade = unidadeDeVenda?.unitId ?? '';
  const totalDosProdutos = totalDosItens(itens);
  // O aparelho do cliente é forma de pagamento: o que sobra é o que ele paga.
  const daTroca = comTroca ? Number(troca.valorAvaliado) || 0 : 0;
  const total = Math.max(0, totalDosProdutos - daTroca);
  // Sugestão, não restrição: quem vende no salão muitas vezes não tem login,
  // e filtrar por perfil deixava a lista praticamente vazia.
  const sugestoes = (usuarios?.data ?? []).map((u) => u.name).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  /** Liga a venda ao usuário quando o nome digitado bate com um cadastrado. */
  const usuarioDoNome = (nome: string) =>
    (usuarios?.data ?? []).find((u) => u.name.trim().toLowerCase() === nome.trim().toLowerCase());

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    // Cliente é opcional no balcão: quem paga um cabo à vista não precisa
    // se identificar, e a fila anda.
    if (!itens.length) return toast.warning('Adicione ao menos um produto');

    if (comTroca) {
      if (!troca.modelo.trim()) return toast.warning('Informe o modelo do aparelho da troca');
      if (daTroca <= 0) return toast.warning('Informe quanto vale o aparelho do cliente');
      if (daTroca > totalDosProdutos) {
        return toast.warning(
          'A troca vale mais que a compra',
          'Ajuste a avaliação ou acrescente produtos.',
        );
      }
    }

    // Pix sem conta não dá para conferir no extrato de ninguém.
    if (!dividido && form.paymentMethod === 'PIX' && contasPix.length > 0 && !form.destino) {
      return toast.warning('Escolha a conta do Pix', 'Toque em PIX RAFA, PIX CLARA ou PIX DIEGO TELES.');
    }

    if (dividido && formas.some((f) => f.method === 'PIX' && contasPix.length > 0 && !f.destino)) {
      return toast.warning('Falta a conta de um dos Pix', 'Escolha em qual conta cada Pix caiu.');
    }

    if (form.paymentMethod === 'EM_ABERTO' && !dividido) {
      const pago = Number(form.entrada) || 0;
      if (pago > total) {
        return toast.warning('A entrada passou do valor da venda', 'Ajuste o quanto ele paga agora.');
      }
      if (!form.customerName.trim() || !form.customerPhone.trim()) {
        return toast.warning(
          'Falta quem vai pagar',
          'Valor em aberto precisa do nome e do telefone do cliente.',
        );
      }
    }

    if (dividido && Math.abs(somaDasFormas(formas) - total) >= 0.01) {
      return toast.warning(
        'As formas não fecham com o total',
        'Ajuste os valores até não sobrar nem faltar.',
      );
    }

    try {
      const venda = await criar.mutateAsync({
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
        payments: dividido
          ? paraApi(true, formas)
          : (pagamentoEmAberto() ??
            // Só para carregar a conta que recebeu; sem destino a venda
            // continua sem rateio, como antes.
            (form.destino
              ? [
                  {
                    method: form.paymentMethod,
                    amount: total,
                    installments: Number(form.installments) || 1,
                    destino: form.destino,
                  },
                ]
              : undefined)),
        tradeIn: trocaParaApi(comTroca, troca),
        customerName: form.customerName.trim() || null,
        customerPhone: form.customerPhone.trim() || null,
        customerDocument: form.customerDocument.trim() || null,
        // Só o nome. Quem liga ao usuário (e à comissão) é o servidor —
        // assim a tela não consegue gravar venda com dono contraditório.
        sellerName: form.vendedor.trim() || null,
        notes: form.notes.trim() || null,
      });

      toast.success('Venda registrada', 'Estoque atualizado e movimentação gerada.');
      // O comprovante aparece agora, que é quando o cliente ainda está aqui.
      if (venda?.id) {
        setRecibo({ id: venda.id, code: venda.code, totalAmount: Number(venda.totalAmount) });
      }
      setItens([]);
      setForm((f) => ({ ...f, customerName: '', customerPhone: '', customerDocument: '', notes: '' }));
      setDividido(false);
      setFormas([]);
      setForm((f) => ({ ...f, paymentMethod: 'PIX', destino: '', entrada: '', formaDaEntrada: 'PIX' }));
      setComTroca(false);
      setTroca(trocaVazia());
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
          {/* A ordem segue o atendimento: primeiro o que ele leva, depois
              como paga, e o cadastro por último — que é opcional. */}
          <Secao numero={1} titulo="O que o cliente está levando">
            <CarrinhoDeItens itens={itens} aoMudar={setItens} unidadeId={unidade} />

            <TrocaNoBalcao
              ligada={comTroca}
              aoLigar={setComTroca}
              troca={troca}
              aoMudar={setTroca}
              totalDosProdutos={totalDosProdutos}
            />
          </Secao>

          <Secao
            numero={2}
            titulo="Como vai pagar"
            complemento={itens.length > 0 ? formatCurrency(total) : undefined}
          >
            <FormasDePagamento
            dividido={dividido}
            aoDividir={setDividido}
            formas={formas}
            aoMudarFormas={setFormas}
            formaUnica={form.paymentMethod}
            aoMudarFormaUnica={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
            destino={form.destino}
            aoMudarDestino={(v) => setForm((f) => ({ ...f, destino: v }))}
            parcelas={form.installments}
            aoMudarParcelas={(v) => setForm((f) => ({ ...f, installments: v }))}
            entrada={form.entrada}
            aoMudarEntrada={(v) => setForm((f) => ({ ...f, entrada: v }))}
            formaDaEntrada={form.formaDaEntrada}
            aoMudarFormaDaEntrada={(v) => setForm((f) => ({ ...f, formaDaEntrada: v }))}
            total={total}
            />
          </Secao>

          <Secao numero={3} titulo="Quem atendeu">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* A loja vende de um lugar só: mostrar basta, escolher seria
                mais um campo para errar. Muda em Configurações. */}
            <div>
              <p className="label-base">Sai do estoque de</p>
              <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-navy-900 dark:bg-navy-800 dark:text-slate-100">
                <Store className="h-4 w-4 text-slate-400" />
                {unidades.find((u) => u.id === unidade)?.name ?? 'carregando…'}
              </p>
            </div>
            <div>
              <Input
                label="Vendedor"
                value={form.vendedor}
                onChange={(e) => setForm((f) => ({ ...f, vendedor: e.target.value }))}
                placeholder={user?.name ?? 'Eu mesmo'}
                list="vendedores-pdv"
                hint={
                  form.vendedor.trim()
                    ? usuarioDoNome(form.vendedor)
                      ? 'Vendedor cadastrado — entra na comissão dele'
                      : 'Nome livre — fica registrado na venda'
                    : 'Em branco = você mesmo'
                }
              />
              <datalist id="vendedores-pdv">
                {sugestoes.map((nome) => (
                  <option key={nome} value={nome} />
                ))}
              </datalist>
            </div>
          </div>
          </Secao>

          <Secao numero={4} titulo="Cliente" opcional>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                label="Nome"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Consumidor"
                required={form.paymentMethod === 'EM_ABERTO' && !dividido}
              />
              <Input
                label="CPF"
                value={form.customerDocument}
                onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
                placeholder="opcional"
              />
              <Input
                label="Telefone"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="opcional"
                required={form.paymentMethod === 'EM_ABERTO' && !dividido}
              />
            </div>

            <Textarea
              label="Observação"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Combinações, garantia, troca…"
            />
          </Secao>

          {/* O botão carrega o valor: é a última conferência antes de fechar. */}
          <Button
            type="submit"
            variant="success"
            loading={criar.isPending}
            disabled={!itens.length || !unidade}
            icon={<Check className="h-4 w-4" />}
            className="w-full py-3 text-base"
          >
            Finalizar venda · {formatCurrency(total)}
          </Button>
        </form>

        <ReciboDaVenda venda={recibo} aoFechar={() => setRecibo(null)} />
      </CardBody>
    </Card>
  );
}

/**
 * Um passo do atendimento.
 *
 * Numerar dá ao caixa uma ordem para seguir quando a loja está cheia — e
 * separa visualmente o que é obrigatório do que é conferência.
 */
function Secao({
  numero,
  titulo,
  complemento,
  opcional,
  children,
}: {
  numero: number;
  titulo: string;
  complemento?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white dark:bg-accent">
          {numero}
        </span>
        <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100">{titulo}</h3>
        {opcional && (
          <span className="text-xs font-normal text-slate-400">opcional</span>
        )}
        {complemento && (
          <span className="ml-auto text-sm font-extrabold text-navy-900 dark:text-slate-100">
            {complemento}
          </span>
        )}
      </div>
      {children}
    </section>
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
          {/* Número de caixa errado sem aviso é pior que caixa sem número. */}
          {Boolean(resumo.divergencia) && (
            <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm font-semibold text-danger dark:bg-danger/15">
              As formas de pagamento não somam o total do turno — diferença de{' '}
              {formatCurrency(Math.abs(resumo.divergencia))}. Avise o administrador antes de fechar.
            </p>
          )}

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
