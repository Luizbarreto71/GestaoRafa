import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { TAXAS_PADRAO, valorNoCartao, type TaxaDeCartao } from '@shared/taxas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Quanto a loja cobraria num aparelho de mil, para conferir de relance. */
const EXEMPLO = 1000;

/**
 * Tabela de taxas da maquininha.
 *
 * É daqui que o caixa tira quanto cobrar no cartão. Duas colunas porque Elo
 * e Amex custam mais; deixar a segunda vazia faz a linha valer para todas
 * as bandeiras — é o caso das parcelas longas, de taxa única.
 */
export function TaxasDeCartao() {
  const [linhas, setLinhas] = useState<TaxaDeCartao[]>(TAXAS_PADRAO);
  const [mexeu, setMexeu] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['taxas-cartao'],
    queryFn: async () => {
      const { data } = await api.get<{ taxas: TaxaDeCartao[] }>('/settings/taxas-cartao');
      return data.taxas;
    },
  });

  useEffect(() => {
    if (data) {
      setLinhas(data);
      setMexeu(false);
    }
  }, [data]);

  const salvar = useMutation({
    mutationFn: async (taxas: TaxaDeCartao[]) => {
      const { data } = await api.put<{ message: string }>('/settings/taxas-cartao', { taxas });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Taxas salvas', r.message);
      setMexeu(false);
      void queryClient.invalidateQueries({ queryKey: ['taxas-cartao'] });
    },
    onError: () => toast.error('Não foi possível salvar as taxas'),
  });

  const alterar = (i: number, mudanca: Partial<TaxaDeCartao>) => {
    setLinhas((atual) => atual.map((l, indice) => (indice === i ? { ...l, ...mudanca } : l)));
    setMexeu(true);
  };

  const remover = (i: number) => {
    setLinhas((atual) => atual.filter((_, indice) => indice !== i));
    setMexeu(true);
  };

  function acrescentar() {
    const proxima = Math.max(0, ...linhas.map((l) => l.parcelas)) + 1;
    if (proxima > 24) return toast.warning('O limite é 24 parcelas');
    setLinhas((atual) => [...atual, { parcelas: proxima, padrao: 0, elo: null }]);
    setMexeu(true);
  }

  return (
    <Card>
      <CardHeader
        title="Taxas do cartão de crédito"
        subtitle="O caixa usa esta tabela para saber quanto cobrar em cada parcelamento"
        action={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinhas(TAXAS_PADRAO);
                setMexeu(true);
              }}
              icon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Restaurar
            </Button>
            <Button
              size="sm"
              disabled={!mexeu}
              loading={salvar.isPending}
              onClick={() => salvar.mutate(linhas)}
              icon={<Save className="h-3.5 w-3.5" />}
            >
              Salvar
            </Button>
          </div>
        }
      />

      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left dark:border-navy-700">
                <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400">Parcelas</th>
                <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400">
                  Visa / Master
                </th>
                <th className="pb-2 font-semibold text-slate-500 dark:text-slate-400">Elo / Amex</th>
                <th className="pb-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                  Cobrar em {formatCurrency(EXEMPLO)}
                </th>
                <th />
              </tr>
            </thead>

            <tbody>
              {linhas.map((linha, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-navy-800">
                  <td className="py-1.5">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={linha.parcelas}
                      onChange={(e) => alterar(i, { parcelas: Number(e.target.value) || 1 })}
                      className="w-16 rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-navy-600"
                    />
                    <span className="ml-1 text-slate-400">x</span>
                  </td>

                  <td className="py-1.5">
                    <Porcentagem
                      valor={linha.padrao}
                      aoMudar={(v) => alterar(i, { padrao: v ?? 0 })}
                    />
                  </td>

                  <td className="py-1.5">
                    <Porcentagem
                      valor={linha.elo ?? null}
                      aoMudar={(v) => alterar(i, { elo: v })}
                      vazioPermitido
                    />
                  </td>

                  <td className="py-1.5 text-right">
                    {/* O número que a pessoa realmente confere: a taxa é
                        abstrata, o valor cobrado não. */}
                    <span className="font-semibold text-navy-900 dark:text-slate-200">
                      {formatCurrency(valorNoCartao(EXEMPLO, linha.padrao))}
                    </span>
                    {linha.elo != null && linha.elo !== linha.padrao && (
                      <span className="block text-xs text-slate-400">
                        Elo/Amex {formatCurrency(valorNoCartao(EXEMPLO, linha.elo))}
                      </span>
                    )}
                  </td>

                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      className="rounded p-1.5 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                      aria-label={`Remover ${linha.parcelas}x`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={acrescentar}
          className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          Mais uma faixa
        </button>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Elo/Amex em branco significa taxa única — a linha vale para todas as bandeiras. O valor
          cobrado é calculado para a loja <strong>receber o preço à vista limpo</strong>, já
          descontada a taxa da maquininha.
        </p>
      </CardBody>
    </Card>
  );
}

/** Campo de porcentagem que aceita ficar vazio. */
function Porcentagem({
  valor,
  aoMudar,
  vazioPermitido,
}: {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  vazioPermitido?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={99.99}
        step="0.01"
        value={valor ?? ''}
        placeholder={vazioPermitido ? '—' : '0,00'}
        onChange={(e) => aoMudar(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(
          'w-24 rounded border border-slate-300 bg-transparent px-2 py-1 text-sm dark:border-navy-600',
        )}
      />
      <span className="text-slate-400">%</span>
    </span>
  );
}
