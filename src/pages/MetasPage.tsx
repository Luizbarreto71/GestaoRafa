import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useUnit } from '@/contexts/UnitContext';
import { api, downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency, toInputDate } from '@/lib/format';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download, FileText, Target, Trophy } from 'lucide-react';
import { useState } from 'react';

type Dia = { data: string; aparelhos: number; faturamento: number; bateu: boolean };

type Vendedor = {
  chave: string;
  nome: string;
  grafias: string[];
  aparelhos: number;
  vendas: number;
  faturamento: number;
  lucro: number;
  dias: Dia[];
  diasComVenda: number;
  diasBatidos: number;
  meta: number;
  atingiu: boolean;
  faltam: number;
  progresso: number;
};

type Placar = {
  rotulo: string;
  umDia: boolean;
  meta: number;
  vendedores: Vendedor[];
  resumo: { vendedores: number; bateram: number; aparelhos: number; faturamento: number };
  parecidos: string[][];
};

/**
 * O placar das metas.
 *
 * A meta é diária, então a tela abre no dia de hoje: é o número que o dono
 * quer ver enquanto a loja está aberta. Escolhendo um período, ela troca a
 * pergunta — de "quanto falta hoje" para "em quantos dias cada um bateu".
 */
export default function MetasPage() {
  const hoje = toInputDate(new Date());
  const [inicio, setInicio] = useState(hoje);
  const [fim, setFim] = useState(hoje);
  const [unitId, setUnitId] = useState('');
  const [aberto, setAberto] = useState<Vendedor | null>(null);

  const { unidades } = useUnit();

  const { data, isLoading } = useQuery({
    queryKey: ['metas', inicio, fim, unitId],
    queryFn: async () => {
      const { data } = await api.get<Placar>('/metas', {
        params: { inicio, fim, ...(unitId ? { unitId } : {}) },
      });
      return data;
    },
    // O placar do dia muda o tempo todo enquanto a loja vende.
    refetchInterval: 60_000,
  });

  const lista = data?.vendedores ?? [];
  const umDia = data?.umDia ?? true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-navy-900 dark:text-slate-50">
            <Target className="h-6 w-6 text-accent" />
            Metas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data ? `${data.meta} aparelhos por dia · ${data.rotulo}` : 'Carregando…'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { r: 'Hoje', i: hoje, f: hoje },
            { r: 'Últimos 7 dias', i: toInputDate(new Date(Date.now() - 6 * 86400000)), f: hoje },
            { r: 'Este mês', i: toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), f: hoje },
          ].map((p) => (
            <button
              key={p.r}
              type="button"
              onClick={() => {
                setInicio(p.i);
                setFim(p.f);
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                inicio === p.i && fim === p.f
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-400',
              )}
            >
              {p.r}
            </button>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------- filtros */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="De" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Input label="Até" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        <Select
          label="Unidade"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          options={unidades.map((u) => ({ value: u.id, label: u.name }))}
          placeholder="Todas"
        />
      </div>

      {/* ------------------------------------------------------------ resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { rotulo: 'Vendedores', valor: String(data?.resumo.vendedores ?? 0) },
          {
            rotulo: umDia ? 'Bateram a meta' : 'Bateram todos os dias',
            valor: `${data?.resumo.bateram ?? 0}`,
            destaque: (data?.resumo.bateram ?? 0) > 0,
          },
          { rotulo: 'Aparelhos', valor: String(data?.resumo.aparelhos ?? 0) },
          { rotulo: 'Faturamento', valor: formatCurrency(data?.resumo.faturamento ?? 0) },
        ].map((c) => (
          <Card key={c.rotulo}>
            <CardBody className="py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.rotulo}</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-extrabold',
                  c.destaque ? 'text-success' : 'text-navy-900 dark:text-slate-50',
                )}
              >
                {c.valor}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Nomes que parecem a mesma pessoa: a meta de quem vende onze não
          pode aparecer partida em duas por causa de digitação. */}
      {data?.parecidos.length ? (
        <div className="flex gap-2.5 rounded-lg bg-warning-bg px-4 py-3 text-sm dark:bg-warning/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-slate-700 dark:text-slate-300">
            Estes nomes parecem a mesma pessoa escrita de dois jeitos:{' '}
            <strong>{data.parecidos.map((p) => p.join(' / ')).join(' · ')}</strong>. Cada um conta a
            própria meta — corrija no caixa para juntar.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------------------- lista */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
      ) : lista.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-semibold text-navy-900 dark:text-slate-100">Nenhuma venda no período</p>
            <p className="mt-1 text-sm text-slate-500">
              O placar se monta sozinho conforme as vendas vão sendo registradas no caixa.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {lista.map((v, i) => (
            <Card key={v.chave}>
              <CardBody className="py-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      i === 0 && v.aparelhos > 0
                        ? 'bg-warning/20 text-warning'
                        : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400',
                    )}
                  >
                    {i === 0 && v.aparelhos > 0 ? <Trophy className="h-4 w-4" /> : i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-bold text-navy-900 dark:text-slate-100">
                      {v.nome}
                      {v.atingiu && <Badge tone="success">meta batida</Badge>}
                      {v.grafias.length > 1 && (
                        <span className="text-[11px] font-normal text-slate-400">
                          também escrito {v.grafias.filter((g) => g !== v.nome).join(', ')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {v.vendas} venda(s) · {formatCurrency(v.faturamento)}
                      {!umDia && ` · bateu em ${v.diasBatidos} de ${v.diasComVenda} dia(s)`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-extrabold leading-none text-navy-900 dark:text-slate-50">
                      {v.aparelhos}
                      {umDia && <span className="text-base font-semibold text-slate-400">/{v.meta}</span>}
                    </p>
                    <p className={cn('text-xs font-semibold', v.atingiu ? 'text-success' : 'text-slate-500')}>
                      {umDia ? (v.atingiu ? 'meta batida' : `faltam ${v.faltam}`) : 'aparelhos'}
                    </p>
                  </div>

                  <div className="flex gap-1.5">
                    <Button variant="ghost" onClick={() => setAberto(v)} icon={<FileText className="h-4 w-4" />}>
                      Ver vendas
                    </Button>
                  </div>
                </div>

                {/* A barra só faz sentido no dia: num período de vários dias,
                    o que conta é quantos deles ele bateu. */}
                {umDia ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                    <div
                      className={cn('h-full rounded-full transition-all', v.atingiu ? 'bg-success' : 'bg-accent')}
                      style={{ width: `${v.progresso}%` }}
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {v.dias.map((d) => (
                      <span
                        key={d.data}
                        title={`${d.data} · ${d.aparelhos} aparelho(s)`}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                          d.bateu
                            ? 'bg-success-bg text-success dark:bg-success/15'
                            : 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400',
                        )}
                      >
                        {d.data.slice(0, 5)} · {d.aparelhos}
                      </span>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <VendasDoVendedor
        vendedor={aberto}
        inicio={inicio}
        fim={fim}
        unitId={unitId}
        aoFechar={() => setAberto(null)}
      />
    </div>
  );
}

type Detalhe = {
  nome: string;
  rotulo: string;
  umDia: boolean;
  meta: number;
  itens: {
    data: string;
    venda: string;
    produto: string;
    detalhes: string;
    imei: string;
    cliente: string;
    quantidade: number;
    valor: number;
    lucro: number;
  }[];
  dias: { data: string; aparelhos: number; bateu: boolean }[];
  totais: {
    aparelhos: number;
    faturamento: number;
    lucro: number;
    vendas: number;
    diasComVenda: number;
    diasBatidos: number;
  };
};

/** Tudo o que o vendedor vendeu: aparelho, data, IMEI e valor. */
function VendasDoVendedor({
  vendedor,
  inicio,
  fim,
  unitId,
  aoFechar,
}: {
  vendedor: Vendedor | null;
  inicio: string;
  fim: string;
  unitId: string;
  aoFechar: () => void;
}) {
  const [baixando, setBaixando] = useState(false);

  const { data } = useQuery({
    queryKey: ['metas', vendedor?.chave, inicio, fim, unitId],
    enabled: Boolean(vendedor),
    queryFn: async () => {
      const { data } = await api.get<Detalhe>(`/metas/${encodeURIComponent(vendedor!.chave)}`, {
        params: { inicio, fim, ...(unitId ? { unitId } : {}) },
      });
      return data;
    },
  });

  async function baixar(formato: 'pdf' | 'xlsx') {
    if (!vendedor) return;
    setBaixando(true);
    try {
      await downloadFile(
        `/metas/${encodeURIComponent(vendedor.chave)}`,
        { inicio, fim, format: formato, ...(unitId ? { unitId } : {}) },
        `vendas-${vendedor.nome.toLowerCase().replace(/\s+/g, '-')}.${formato}`,
      );
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Modal
      open={Boolean(vendedor)}
      onClose={aoFechar}
      title={vendedor ? `Vendas de ${vendedor.nome}` : ''}
      description={data ? `${data.rotulo} · meta de ${data.meta} por dia` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button
            variant="outline"
            loading={baixando}
            onClick={() => void baixar('xlsx')}
            icon={<Download className="h-4 w-4" />}
          >
            Excel
          </Button>
          <Button loading={baixando} onClick={() => void baixar('pdf')} icon={<FileText className="h-4 w-4" />}>
            PDF
          </Button>
        </>
      }
    >
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { r: 'Aparelhos', v: String(data.totais.aparelhos) },
              { r: 'Vendas', v: String(data.totais.vendas) },
              { r: 'Faturamento', v: formatCurrency(data.totais.faturamento) },
              {
                r: data.umDia ? 'Meta do dia' : 'Dias em que bateu',
                v: data.umDia
                  ? data.totais.aparelhos >= data.meta
                    ? 'batida'
                    : `faltam ${data.meta - data.totais.aparelhos}`
                  : `${data.totais.diasBatidos} de ${data.totais.diasComVenda}`,
              },
            ].map((c) => (
              <div key={c.r} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-navy-800">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{c.r}</p>
                <p className="font-bold text-navy-900 dark:text-slate-100">{c.v}</p>
              </div>
            ))}
          </div>

          <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-navy-800">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Aparelho</th>
                  <th className="px-3 py-2">IMEI</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((i, n) => (
                  <tr key={`${i.venda}-${n}`} className="border-t border-slate-100 dark:border-navy-800">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{i.data}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-navy-900 dark:text-slate-100">{i.produto}</p>
                      <p className="text-xs text-slate-500">
                        {i.detalhes} · {i.cliente}
                      </p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{i.imei}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                      {formatCurrency(i.valor)}
                    </td>
                  </tr>
                ))}
                {data.itens.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                      Nenhuma venda no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
