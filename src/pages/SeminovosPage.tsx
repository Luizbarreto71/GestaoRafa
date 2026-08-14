import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useDebounce } from '@/hooks/useDebounce';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, formatDate } from '@/lib/format';
import { pode } from '@/lib/permissoes';
import { ARMAZENAMENTOS } from '@shared/trocas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Repeat2, Search, ShoppingBag, Smartphone, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Seminovo = {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  capacity?: string | null;
  imei?: string | null;
  costPrice: number;
  salePrice: number;
  notes?: string | null;
  createdAt: string;
  quantidade: number;
  origem: 'troca' | 'compra';
  seminovoOrigem?: string | null;
  category?: { id: string; name: string } | null;
  stock?: { unitId: string; quantity: number; unit?: { name: string } | null }[];
  tradeInAparelho?: {
    estado?: string | null;
    defeitos: string[];
    tradeIn?: { code: string; customerName: string } | null;
  } | null;
};

type Resposta = {
  data: Seminovo[];
  meta: { total: number };
  resumo: { pecas: number; investido: number };
};

/**
 * Os aparelhos usados que a loja tem.
 *
 * Não é um estoque paralelo: cada um destes é um produto normal, que já
 * está na prateleira e é vendido como qualquer outro. Esta tela existe
 * para responder a pergunta que o estoque geral não responde — quanto de
 * usado entrou, de onde veio e quanto a loja pagou por ele.
 */
export default function SeminovosPage() {
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [unitId, setUnitId] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  const termo = useDebounce(busca, 300);
  const { user } = useAuth();
  const { unidades } = useUnit();
  const podeCadastrar = pode(user?.role, 'produtos.editar');

  const { data, isLoading } = useQuery({
    queryKey: ['seminovos', termo, origem, unitId],
    queryFn: async () => {
      const { data } = await api.get<Resposta>('/seminovos', {
        params: {
          ...(termo ? { search: termo } : {}),
          ...(origem ? { origem } : {}),
          ...(unitId ? { unitId } : {}),
          pageSize: 60,
        },
      });
      return data;
    },
  });

  const lista = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            <Smartphone className="h-6 w-6 text-accent" />
            Seminovos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aparelhos usados que entraram por troca ou compra. Continuam no estoque normalmente.
          </p>
        </div>

        {podeCadastrar && (
          <Button onClick={() => setCadastrando(true)} icon={<Plus className="h-4 w-4" />}>
            Comprei aparelhos
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------------ resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { rotulo: 'Aparelhos cadastrados', valor: String(data?.meta.total ?? 0) },
          { rotulo: 'Peças na prateleira', valor: String(data?.resumo.pecas ?? 0) },
          { rotulo: 'Investido em usados', valor: formatCurrency(data?.resumo.investido ?? 0) },
        ].map((c) => (
          <Card key={c.rotulo}>
            <CardBody className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy-900 dark:text-slate-50">{c.valor}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------------------ filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Modelo, cor, IMEI ou de quem veio…"
          icon={<Search className="h-4 w-4" />}
        />
        <Select
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          options={[
            { value: 'troca', label: 'Vieram de troca' },
            { value: 'compra', label: 'Comprados' },
          ]}
          placeholder="Toda origem"
        />
        <Select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          placeholder="Todas as unidades"
        />
      </div>

      {/* -------------------------------------------------------------- lista */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <Smartphone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-navy-900 dark:text-slate-100">Nenhum seminovo por aqui</p>
            <p className="mt-1 text-sm text-slate-500">
              Todo aparelho recebido em troca entra sozinho nesta lista. Os comprados sem troca você
              cadastra no botão acima — vários de uma vez, se o lote chegou junto.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((s) => (
            <Card key={s.id}>
              <CardBody className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy-900 dark:text-slate-100">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[s.color, s.capacity, s.brand].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge tone={s.origem === 'troca' ? 'info' : 'neutral'}>
                    {s.origem === 'troca' ? (
                      <span className="flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" /> troca
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" /> compra
                      </span>
                    )}
                  </Badge>
                </div>

                {s.imei && (
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">IMEI {s.imei}</p>
                )}

                {s.tradeInAparelho?.defeitos?.length ? (
                  <p className="text-xs text-warning">
                    {s.tradeInAparelho.defeitos.length} defeito(s) anotado(s) na troca
                  </p>
                ) : null}

                <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-2 dark:border-navy-800">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Pagamos</p>
                    <p className="font-bold text-navy-900 dark:text-slate-100">
                      {formatCurrency(s.costPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {s.salePrice > 0 ? 'Vende por' : 'Sem preço'}
                    </p>
                    <p
                      className={cn(
                        'font-bold',
                        s.salePrice > 0 ? 'text-success' : 'text-warning',
                      )}
                    >
                      {s.salePrice > 0 ? formatCurrency(s.salePrice) : 'a definir'}
                    </p>
                  </div>
                  <Badge tone={s.quantidade > 0 ? 'success' : 'neutral'}>
                    {s.quantidade > 0 ? `${s.quantidade} em estoque` : 'vendido'}
                  </Badge>
                </div>

                <p className="truncate text-[11px] text-slate-400">
                  {s.seminovoOrigem ?? '—'} · {formatDate(s.createdAt)}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <FormularioDeCompra aberto={cadastrando} aoFechar={() => setCadastrando(false)} />
    </div>
  );
}

/** Uma linha da lista de compra. */
type LinhaDeCompra = {
  modelo: string;
  armazenamento: string;
  cor: string;
  imei: string;
  valorPago: string;
  salePrice: string;
};

const linhaVazia = (): LinhaDeCompra => ({
  modelo: '',
  armazenamento: '',
  cor: '',
  imei: '',
  valorPago: '',
  salePrice: '',
});

/**
 * Cadastro dos aparelhos que a loja comprou sem ser em troca.
 *
 * Em lista porque usado quase nunca chega sozinho: vem um lote de uma vez,
 * e abrir e fechar a janela dez vezes seria a parte mais demorada do
 * negócio. Unidade e de quem foi comprado valem para o lote inteiro — o
 * que muda de peça para peça é modelo, IMEI e preço.
 */
function FormularioDeCompra({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [linhas, setLinhas] = useState<LinhaDeCompra[]>([linhaVazia()]);
  const [unitId, setUnitId] = useState('');
  const [vendedor, setVendedor] = useState('');

  const toast = useToast();
  const { unidades } = useUnit();
  const queryClient = useQueryClient();

  const alterar = (i: number, mudanca: Partial<LinhaDeCompra>) =>
    setLinhas((atual) => atual.map((l, n) => (n === i ? { ...l, ...mudanca } : l)));

  const preenchidas = linhas.filter((l) => l.modelo.trim());
  const total = preenchidas.reduce((s, l) => s + (Number(l.valorPago) || 0), 0);

  const criar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ message: string; criados: number }>('/seminovos', {
        unitId: unitId || unidades[0]?.id,
        vendedor: vendedor.trim() || null,
        aparelhos: preenchidas.map((l) => ({
          modelo: l.modelo.trim(),
          armazenamento: l.armazenamento.trim() || null,
          cor: l.cor.trim() || null,
          imei: l.imei.replace(/\D/g, '') || null,
          valorPago: Number(l.valorPago) || 0,
          salePrice: Number(l.salePrice) || 0,
        })),
      });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Seminovos cadastrados', r.message);
      void queryClient.invalidateQueries({ queryKey: ['seminovos'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setLinhas([linhaVazia()]);
      setVendedor('');
      aoFechar();
    },
    onError: (e) => toast.error('Não foi possível cadastrar', getErrorMessage(e)),
  });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!preenchidas.length) return toast.warning('Informe ao menos um aparelho');

    const semValor = preenchidas.findIndex((l) => !(Number(l.valorPago) || 0));
    if (semValor >= 0) {
      return toast.warning(
        `Aparelho ${semValor + 1}: ${preenchidas[semValor].modelo}`,
        'Informe quanto a loja pagou por ele.',
      );
    }

    const imeis = preenchidas.map((l) => l.imei.replace(/\D/g, '')).filter(Boolean);
    const curto = imeis.find((i) => i.length !== 15);
    if (curto) return toast.warning('IMEI incompleto', `O IMEI tem 15 números — "${curto}" tem ${curto.length}.`);

    const repetido = imeis.find((i, n) => imeis.indexOf(i) !== n);
    if (repetido) return toast.warning('IMEI repetido', `O número ${repetido} está em dois aparelhos.`);

    criar.mutate();
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Aparelhos comprados"
      description="Usados que a loja comprou sem ser em troca"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-seminovo"
            loading={criar.isPending}
            icon={<Check className="h-4 w-4" />}
          >
            {preenchidas.length > 1 ? `Cadastrar ${preenchidas.length} aparelhos` : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <form id="form-seminovo" onSubmit={enviar} className="space-y-4">
        {/* Valem para o lote inteiro: quem vendeu costuma ser o mesmo, e a
            unidade também. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Onde os aparelhos ficaram"
            value={unitId || unidades[0]?.id || ''}
            onChange={(e) => setUnitId(e.target.value)}
            options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Input
            label="Comprado de quem"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            placeholder="Nome de quem vendeu"
            hint="Serve para achar o dono se aparecer problema"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="label-base mb-0">
              {preenchidas.length > 1 ? `${preenchidas.length} aparelhos` : 'Aparelhos'}
            </p>
            {total > 0 && (
              <span className="text-sm font-bold text-navy-900 dark:text-slate-100">
                {formatCurrency(total)}
              </span>
            )}
          </div>

          {linhas.map((linha, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 p-3 dark:border-navy-700"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                {linhas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLinhas((atual) => atual.filter((_, n) => n !== i))}
                    className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                    aria-label={`Remover aparelho ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <div className="col-span-2 sm:col-span-2">
                  <Input
                    label="Modelo"
                    value={linha.modelo}
                    onChange={(e) => alterar(i, { modelo: e.target.value })}
                    placeholder="iPhone 13 Pro"
                    autoFocus={i > 0}
                  />
                </div>
                <Input
                  label="Gigas"
                  value={linha.armazenamento}
                  onChange={(e) => alterar(i, { armazenamento: e.target.value })}
                  placeholder="256GB"
                  list="gigas-seminovo"
                />
                <Input
                  label="Cor"
                  value={linha.cor}
                  onChange={(e) => alterar(i, { cor: e.target.value })}
                  placeholder="Grafite"
                />
                <Input
                  label="Pagamos"
                  type="number"
                  min={0}
                  step="0.01"
                  value={linha.valorPago}
                  onChange={(e) => alterar(i, { valorPago: e.target.value })}
                />
                <Input
                  label="Vende por"
                  type="number"
                  min={0}
                  step="0.01"
                  value={linha.salePrice}
                  onChange={(e) => alterar(i, { salePrice: e.target.value })}
                />
              </div>

              <div className="mt-2">
                <Input
                  label="IMEI"
                  inputMode="numeric"
                  value={linha.imei}
                  onChange={(e) => alterar(i, { imei: e.target.value })}
                  placeholder="opcional — 15 números"
                  hint={linha.imei ? `${linha.imei.replace(/\D/g, '').length}/15` : undefined}
                />
              </div>
            </div>
          ))}

          <datalist id="gigas-seminovo">
            {ARMAZENAMENTOS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          {linhas.length < 50 && (
            <button
              type="button"
              onClick={() => setLinhas((atual) => [...atual, linhaVazia()])}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-accent hover:text-accent dark:border-navy-600 dark:text-slate-400"
            >
              <Plus className="h-4 w-4" />
              Mais um aparelho
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
