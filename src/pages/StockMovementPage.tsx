import { Badge, TransferBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import {
  useCancelarTransferencia,
  useMovimentarEstoque,
  useProducts,
  useRetirada,
  useSuppliers,
  useTransfers,
  useWithdrawals,
} from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import { EXIT_REASON_OPTIONS, formatDateTime, toInputDate } from '@/lib/format';
import type { Product } from '@/types';
import { WithdrawalPanel } from '@/components/products/WithdrawalPanel';
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  ClipboardCheck,
  Package,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';

type Aba = 'entrada' | 'saida' | 'retirada' | 'transferencia';

/**
 * Onde o estoque se mexe: entrada, saída e transferência entre unidades.
 *
 * As três operações compartilham a mesma escolha de produto — por isso ficam
 * na mesma tela, trocando só o formulário de baixo.
 */
export default function StockMovementPage() {
  const [aba, setAba] = useState<Aba>('entrada');
  const { user } = useAuth();
  const { unidades } = useUnit();
  const { data: retiradas } = useWithdrawals({ status: 'PENDENTE' });

  const aguardando = retiradas?.meta.total ?? 0;
  const ehVendedor = user?.role === 'VENDEDOR';

  if (ehVendedor) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Vendedor não movimenta estoque. Para registrar uma venda, use a tela de Estoque.
          </p>
        </div>
      </Card>
    );
  }

  if (unidades.length === 0) {
    return (
      <Card>
        <div className="px-4 py-16 text-center text-sm text-slate-600 dark:text-slate-400">
          Nenhuma unidade cadastrada. Crie a Matriz e a Sede em Configurações → Unidades.
        </div>
      </Card>
    );
  }

  const abas = [
    { chave: 'entrada' as const, rotulo: 'Entrada', icone: ArrowDownToLine, cor: 'text-success' },
    { chave: 'saida' as const, rotulo: 'Saída', icone: ArrowUpFromLine, cor: 'text-danger' },
    {
      chave: 'retirada' as const,
      rotulo: 'Retirada para a loja',
      icone: ClipboardCheck,
      cor: 'text-warning',
      // O acerto do dia não pode depender de alguém lembrar de conferir.
      contador: aguardando,
    },
    { chave: 'transferencia' as const, rotulo: 'Transferência', icone: ArrowLeftRight, cor: 'text-accent' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
          📦 Movimentação de Estoque
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Toda entrada, saída e transferência fica registrada com unidade, motivo e responsável.
        </p>
      </div>

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
            <item.icone className={cn('h-4 w-4', aba === item.chave ? '' : item.cor)} />
            {item.rotulo}
            {Boolean(item.contador) && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-[11px] font-bold text-white">
                {item.contador}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'entrada' && <FormularioEntrada />}
      {aba === 'saida' && <FormularioSaida />}
      {aba === 'retirada' && <FormularioRetirada />}
      {aba === 'transferencia' && <FormularioTransferencia />}

      {aba === 'retirada' ? <WithdrawalPanel /> : <TransferenciasRecentes />}
    </div>
  );
}

// ------------------------------------------------------- Escolha do produto

/** Campo de busca que mostra o saldo do produto em cada unidade. */
function EscolherProduto({
  produto,
  aoEscolher,
}: {
  produto: Product | null;
  aoEscolher: (p: Product | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const termo = useDebounce(busca, 300);
  const { data } = useProducts({ search: termo, pageSize: 8 });

  if (produto) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
        {produto.photos?.[0] ? (
          <img src={produto.photos[0]} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-400 dark:bg-navy-700">
            <Package className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-navy-900 dark:text-slate-100">{produto.name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {produto.stock?.length ? (
              produto.stock.map((s) => (
                <Badge key={s.unitId} tone={(s.available ?? s.quantity) > 0 ? 'success' : 'danger'}>
                  {s.unitName}: {s.quantity}
                  {s.reserved ? ` (${s.reserved} reservadas)` : ''}
                </Badge>
              ))
            ) : (
              <Badge tone="danger">Sem estoque em nenhuma unidade</Badge>
            )}
          </div>
        </div>

        <Button size="sm" variant="ghost" onClick={() => aoEscolher(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Input
        label="Produto"
        required
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Digite o nome, IMEI, lote ou número de série…"
        icon={<Search className="h-4 w-4" />}
        autoFocus
      />

      {termo.length >= 2 && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
          {data?.data.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nada encontrado para “{termo}”
            </p>
          )}

          {data?.data.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aoEscolher(p)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-navy-900 dark:text-slate-100">
                  {p.name}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {p.stock?.map((s) => `${s.unitName}: ${s.quantity}`).join(' · ') || 'sem estoque'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Unidades que o usuário pode operar. */
function useUnidadesOperaveis() {
  const { unidades } = useUnit();
  const { user } = useAuth();

  return useMemo(() => {
    if (user?.role === 'ADMIN') return unidades;
    return unidades.filter((u) => u.id === user?.unitId);
  }, [unidades, user]);
}

// ------------------------------------------------------------------ Entrada

function FormularioEntrada() {
  const [produto, setProduto] = useState<Product | null>(null);
  const [form, setForm] = useState({
    unitId: '',
    quantity: '1',
    supplierId: '',
    costPrice: '',
    date: toInputDate(new Date()),
    notes: '',
  });

  const toast = useToast();
  const unidades = useUnidadesOperaveis();
  const { data: fornecedores } = useSuppliers({ all: 'true' });
  const entrada = useMovimentarEstoque('entrada');

  const unidadeEscolhida = form.unitId || unidades[0]?.id || '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!produto) return toast.warning('Escolha o produto');
    if (!unidadeEscolhida) return toast.warning('Escolha a unidade');

    try {
      const r = await entrada.mutateAsync({
        productId: produto.id,
        unitId: unidadeEscolhida,
        quantity: Number(form.quantity),
        supplierId: form.supplierId || null,
        ...(form.costPrice ? { costPrice: Number(form.costPrice) } : {}),
        notes: form.notes.trim() || null,
        reason: 'COMPRA',
      });
      toast.success('Entrada registrada', `${r.message} Saldo: ${r.antes} → ${r.depois}`);
      setProduto(null);
      setForm((f) => ({ ...f, quantity: '1', costPrice: '', notes: '' }));
    } catch (erro) {
      toast.error('Não foi possível registrar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Card>
      <CardHeader title="Entrada de estoque" subtitle="Compra, reposição ou devolução de cliente" />
      <CardBody>
        <form onSubmit={enviar} className="space-y-4">
          <EscolherProduto produto={produto} aoEscolher={setProduto} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Unidade"
              required
              value={unidadeEscolhida}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
            />
            <Input
              label="Quantidade"
              required
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <Select
              label="Fornecedor"
              value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
              options={(fornecedores?.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Sem fornecedor"
            />
            <Input
              label="Valor unitário pago"
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={form.costPrice}
              onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
              hint="O que está na nota — entra no custo médio"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <Textarea
              label="Observação"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              wrapperClassName="sm:col-span-2"
              rows={2}
            />
          </div>

          <Button
            type="submit"
            variant="success"
            loading={entrada.isPending}
            icon={<ArrowDownToLine className="h-4 w-4" />}
          >
            Registrar entrada
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// -------------------------------------------------------------------- Saída

function FormularioSaida() {
  const [produto, setProduto] = useState<Product | null>(null);
  const [form, setForm] = useState({
    unitId: '',
    quantity: '1',
    reason: 'PERDA',
    date: toInputDate(new Date()),
    notes: '',
  });

  const toast = useToast();
  const unidades = useUnidadesOperaveis();
  const saida = useMovimentarEstoque('saida');

  const unidadeEscolhida = form.unitId || unidades[0]?.id || '';
  const saldo = produto?.stock?.find((s) => s.unitId === unidadeEscolhida)?.quantity ?? 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!produto) return toast.warning('Escolha o produto');

    try {
      const r = await saida.mutateAsync({
        productId: produto.id,
        unitId: unidadeEscolhida,
        quantity: Number(form.quantity),
        reason: form.reason,
        notes: form.notes.trim() || null,
      });
      toast.success('Saída registrada', `${r.message} Saldo: ${r.antes} → ${r.depois}`);
      setProduto(null);
      setForm((f) => ({ ...f, quantity: '1', notes: '' }));
    } catch (erro) {
      toast.error('Não foi possível registrar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Card>
      <CardHeader title="Saída de estoque" subtitle="Perda, defeito, uso interno, devolução ao fornecedor" />
      <CardBody>
        <form onSubmit={enviar} className="space-y-4">
          <EscolherProduto produto={produto} aoEscolher={setProduto} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Unidade"
              required
              value={unidadeEscolhida}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
              hint={produto ? `Disponível: ${saldo}` : undefined}
            />
            <Input
              label="Quantidade"
              required
              type="number"
              min={1}
              max={saldo || undefined}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              error={
                produto && Number(form.quantity) > saldo
                  ? `Só há ${saldo} un. nesta unidade`
                  : undefined
              }
            />
            <Select
              label="Motivo"
              required
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              options={EXIT_REASON_OPTIONS}
            />
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {form.reason === 'VENDA' && (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning dark:bg-warning/10">
              Esta saída tira o produto do estoque, mas <strong>não registra faturamento</strong>. Para
              uma venda de verdade (com cliente, valor e forma de pagamento), use o botão Vender na
              tela de Estoque.
            </p>
          )}

          <Textarea
            label="Observação"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />

          <Button
            type="submit"
            variant="danger"
            loading={saida.isPending}
            icon={<ArrowUpFromLine className="h-4 w-4" />}
          >
            Registrar saída
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------ Transferência

/** Um produto escolhido para a remessa. */
type ItemDaRemessa = { produto: Product; quantidade: string };

function FormularioTransferencia() {
  const [itens, setItens] = useState<ItemDaRemessa[]>([]);
  const [form, setForm] = useState({
    originUnitId: '',
    destinationUnitId: '',
    date: toInputDate(new Date()),
    notes: '',
  });

  const [levandoTudo, setLevandoTudo] = useState(false);

  const toast = useToast();
  const { unidades } = useUnit();
  const operaveis = useUnidadesOperaveis();
  const transferir = useMovimentarEstoque('transferir');
  const transferirTudo = useMovimentarEstoque('transferirTudo');

  const origem = form.originUnitId || operaveis[0]?.id || '';
  const destino = form.destinationUnitId;

  const saldoNaOrigem = (p: Product) => p.stock?.find((s) => s.unitId === origem)?.quantity ?? 0;
  const pecas = itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);

  /** O que impede a remessa de sair, ou nada. */
  const problema = (() => {
    if (!itens.length) return null;
    for (const i of itens) {
      const qtd = Number(i.quantidade) || 0;
      if (qtd < 1) return `Informe a quantidade de ${i.produto.name}.`;
      if (qtd > saldoNaOrigem(i.produto)) {
        return `${i.produto.name}: só há ${saldoNaOrigem(i.produto)} un. na origem.`;
      }
    }
    return null;
  })();

  function acrescentar(p: Product | null) {
    if (!p) return;
    if (itens.some((i) => i.produto.id === p.id)) {
      return toast.warning('Esse produto já está na remessa', 'Ajuste a quantidade na linha dele.');
    }
    setItens((atual) => [...atual, { produto: p, quantidade: '1' }]);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!itens.length) return toast.warning('Escolha ao menos um produto');
    if (!destino) return toast.warning('Escolha a unidade de destino');
    if (origem === destino) return toast.warning('Origem e destino precisam ser diferentes');
    if (problema) return toast.warning('Confira a remessa', problema);

    try {
      const r = await transferir.mutateAsync({
        originUnitId: origem,
        destinationUnitId: destino,
        itens: itens.map((i) => ({ productId: i.produto.id, quantity: Number(i.quantidade) || 0 })),
        notes: form.notes.trim() || null,
      });
      toast.success('Transferência concluída', r.message);
      setItens([]);
      setForm((f) => ({ ...f, notes: '' }));
    } catch (erro) {
      toast.error('Não foi possível transferir', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Card>
      <CardHeader
        title="🔄 Transferir estoque"
        subtitle="Escolha o que vai na remessa: sai de uma unidade e entra na outra na mesma hora"
      />
      <CardBody>
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="De (origem)"
              required
              value={origem}
              onChange={(e) => setForm((f) => ({ ...f, originUnitId: e.target.value }))}
              options={operaveis.map((u) => ({ value: u.id, label: u.name }))}
            />
            <Select
              label="Para (destino)"
              required
              value={destino}
              onChange={(e) => setForm((f) => ({ ...f, destinationUnitId: e.target.value }))}
              options={unidades.filter((u) => u.id !== origem).map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Selecione…"
            />
          </div>

          {/* A busca não some depois de escolher: quem manda cinco aparelhos
              escolhe um atrás do outro. */}
          <EscolherProduto produto={null} aoEscolher={acrescentar} />

          {/* Esvaziar uma unidade inteira é rotina quando a mercadoria fica
              no escritório e vai para a loja. Escolher sessenta produtos um
              a um para isso seria trabalho de digitação, não de estoque. */}
          {destino && origem !== destino && (
            <button
              type="button"
              onClick={() => setLevandoTudo(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:border-navy-600 dark:text-slate-400"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Levar TUDO da {unidades.find((u) => u.id === origem)?.name} para a{' '}
              {unidades.find((u) => u.id === destino)?.name}
            </button>
          )}

          {itens.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700">
              <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800">
                <span>
                  {itens.length} produto(s) · {pecas} peça(s)
                </span>
                <button
                  type="button"
                  onClick={() => setItens([])}
                  className="font-semibold text-danger hover:underline"
                >
                  Limpar
                </button>
              </div>

              {itens.map((item, i) => {
                const saldo = saldoNaOrigem(item.produto);
                const qtd = Number(item.quantidade) || 0;
                const demais = qtd > saldo;

                return (
                  <div
                    key={item.produto.id}
                    className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-3 py-2.5 dark:border-navy-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                        {item.produto.name}
                      </p>
                      <p className={cn('text-xs', demais ? 'font-semibold text-danger' : 'text-slate-500')}>
                        {demais ? `Só há ${saldo} un. na origem` : `Disponível na origem: ${saldo}`}
                      </p>
                    </div>

                    <input
                      type="number"
                      min={1}
                      max={saldo || undefined}
                      value={item.quantidade}
                      onChange={(e) =>
                        setItens((atual) =>
                          atual.map((x, n) => (n === i ? { ...x, quantidade: e.target.value } : x)),
                        )
                      }
                      aria-label={`Quantidade de ${item.produto.name}`}
                      className={cn(
                        'h-10 w-20 rounded-lg border px-2 text-center text-sm dark:bg-navy-900',
                        demais ? 'border-danger' : 'border-slate-200 dark:border-navy-700',
                      )}
                    />

                    <button
                      type="button"
                      onClick={() => setItens((atual) => atual.filter((_, n) => n !== i))}
                      className="rounded-lg p-2 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                      aria-label={`Tirar ${item.produto.name} da remessa`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {itens.length > 0 && destino && !problema && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <span className="font-semibold text-navy-900 dark:text-slate-100">Depois de confirmar:</span>
              <span className="text-slate-600 dark:text-slate-400">
                {pecas} peça(s) saem da {unidades.find((u) => u.id === origem)?.name}
              </span>
              <ArrowLeftRight className="h-4 w-4 text-accent" />
              <span className="text-slate-600 dark:text-slate-400">
                entram na {unidades.find((u) => u.id === destino)?.name}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <Textarea
              label="Observação"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              wrapperClassName="sm:col-span-2"
              rows={2}
            />
          </div>

          <Button
            type="submit"
            loading={transferir.isPending}
            disabled={!itens.length || Boolean(problema)}
            icon={<ArrowLeftRight className="h-4 w-4" />}
          >
            {itens.length > 1 ? `Transferir ${itens.length} produtos` : 'Confirmar transferência'}
          </Button>
        </form>
      </CardBody>

      <ConfirmDialog
        open={levandoTudo}
        title="Levar tudo para a outra unidade"
        message={
          `Todo o estoque da ${unidades.find((u) => u.id === origem)?.name} vai para a ` +
          `${unidades.find((u) => u.id === destino)?.name} de uma vez. O que estiver separado numa ` +
          `retirada fica onde está. Dá para desfazer depois, cancelando cada transferência.`
        }
        confirmLabel="Levar tudo"
        cancelLabel="Voltar"
        loading={transferirTudo.isPending}
        onCancel={() => setLevandoTudo(false)}
        onConfirm={async () => {
          try {
            const r = await transferirTudo.mutateAsync({
              originUnitId: origem,
              destinationUnitId: destino,
              notes: form.notes.trim() || null,
            });
            toast.success('Remessa concluída', r.message);
            setItens([]);
            setLevandoTudo(false);
          } catch (erro) {
            toast.error('Não foi possível transferir', erro instanceof Error ? erro.message : undefined);
          }
        }}
      />
    </Card>
  );
}

// -------------------------------------------------- Retirada para a loja

/**
 * Leva mercadoria para a loja sem baixar o estoque.
 *
 * O saldo continua o mesmo, mas as peças ficam reservadas até você acertar
 * no fim do dia — porque nem tudo que vai para a loja vende.
 */
function FormularioRetirada() {
  const [produto, setProduto] = useState<Product | null>(null);
  const [form, setForm] = useState({ unitId: '', quantity: '1', notes: '' });

  const toast = useToast();
  const unidades = useUnidadesOperaveis();
  const retirar = useRetirada('criar');

  const unidadeEscolhida = form.unitId || unidades[0]?.id || '';
  const linha = produto?.stock?.find((s) => s.unitId === unidadeEscolhida);
  const livre = linha?.available ?? linha?.quantity ?? 0;
  const quantidade = Number(form.quantity) || 0;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!produto) return toast.warning('Escolha o produto');

    try {
      const r = await retirar.mutateAsync({
        productId: produto.id,
        unitId: unidadeEscolhida,
        quantity: quantidade,
        notes: form.notes.trim() || null,
      });
      toast.success('Retirada registrada', r.message);
      setProduto(null);
      setForm((f) => ({ ...f, quantity: '1', notes: '' }));
    } catch (erro) {
      toast.error('Não foi possível registrar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Retirada para a loja"
        subtitle="O estoque só baixa quando você acertar, no fim do dia"
      />
      <CardBody>
        <form onSubmit={enviar} className="space-y-4">
          <EscolherProduto produto={produto} aoEscolher={setProduto} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select
              label="Unidade"
              required
              value={unidadeEscolhida}
              onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
              options={unidades.map((u) => ({ value: u.id, label: u.name }))}
              hint={produto ? `Livre: ${livre}` : undefined}
            />
            <Input
              label="Quantidade"
              required
              type="number"
              min={1}
              max={livre || undefined}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              error={produto && quantidade > livre ? `Só há ${livre} un. livres` : undefined}
            />
            <Input
              label="Observação"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ex.: mostruário do dia"
            />
          </div>

          {produto && quantidade > 0 && quantidade <= livre && (
            <div className="rounded-lg border border-warning/25 bg-warning-bg/60 px-4 py-3 text-sm dark:bg-warning/10">
              <p className="font-semibold text-navy-900 dark:text-slate-100">Ao confirmar:</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                O estoque continua em <strong>{linha?.quantity ?? 0}</strong>, mas{' '}
                <strong>{quantidade}</strong> ficam reservadas — sobram{' '}
                <strong>{livre - quantidade}</strong> para vender. A baixa acontece só no acerto.
              </p>
            </div>
          )}

          <Button
            type="submit"
            variant="secondary"
            loading={retirar.isPending}
            icon={<ClipboardCheck className="h-4 w-4" />}
          >
            Registrar retirada
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

// -------------------------------------------------- Transferências recentes

function TransferenciasRecentes() {
  const { data } = useTransfers({ page: 1 });
  const { isAdmin } = useAuth();
  const toast = useToast();
  const cancelar = useCancelarTransferencia();
  const [aCancelar, setACancelar] = useState<string | null>(null);

  if (!data?.data.length) return null;

  async function confirmar() {
    if (!aCancelar) return;
    try {
      const r = await cancelar.mutateAsync(aCancelar);
      toast.success('Transferência cancelada', r.message);
      setACancelar(null);
    } catch (erro) {
      toast.error('Não foi possível cancelar', erro instanceof Error ? erro.message : undefined);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Transferências recentes" subtitle="Últimas movimentações entre unidades" />
        <div className="divide-y divide-slate-200 dark:divide-navy-700">
          {data.data.slice(0, 8).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                  {t.quantity}× {t.product.name}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {t.originUnit.name} → {t.destinationUnit.name} · {formatDateTime(t.createdAt)}
                </p>
              </div>

              <TransferBadge status={t.status} />

              {isAdmin && t.status === 'RECEBIDA' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setACancelar(t.id)}
                  icon={<Ban className="h-3.5 w-3.5" />}
                >
                  Cancelar
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(aCancelar)}
        title="Cancelar transferência"
        message="O estoque volta para a unidade de origem. A transferência não é apagada: o cancelamento entra no histórico como novas movimentações."
        confirmLabel="Cancelar transferência"
        cancelLabel="Voltar"
        loading={cancelar.isPending}
        onConfirm={() => void confirmar()}
        onCancel={() => setACancelar(null)}
      />
    </>
  );
}
