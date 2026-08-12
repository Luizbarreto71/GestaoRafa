import { Input, Select } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import {
  liquidoRecebido,
  taxaDe,
  TAXAS_PADRAO,
  valorNoCartao,
  type Bandeira,
  type TaxaDeCartao,
} from '@shared/taxas';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';

/** A tabela salva pelo administrador. Cai no padrão se ninguém mexeu. */
export function useTaxasDeCartao() {
  const { data } = useQuery({
    queryKey: ['taxas-cartao'],
    queryFn: async () => {
      const { data } = await api.get<{ taxas: TaxaDeCartao[] }>('/settings/taxas-cartao');
      return data.taxas;
    },
    staleTime: 5 * 60_000,
  });

  return data ?? TAXAS_PADRAO;
}

/**
 * Fecha o valor de uma venda no crédito.
 *
 * A taxa é descontada pela maquininha, e a loja repassa esse custo ao
 * cliente. O sistema sugere o valor que devolve o preço à vista limpo, mas
 * quem fecha é o vendedor — e o que ele conseguir acima disso é ganho da
 * loja. Por isso o valor cobrado é editável e o ganho aparece.
 */
export function CalculadoraDeCartao({
  taxas,
  aoUsar,
  valorSugerido,
  parcelas: parcelasFora,
  aoMudarParcelas,
}: {
  taxas: TaxaDeCartao[];
  /** Leva o valor fechado para o campo do pagamento. */
  aoUsar?: (valor: number, parcelas: number, taxa: number) => void;
  /** Total do carrinho, que é o preço à vista. */
  valorSugerido?: number;
  /**
   * O parcelamento da venda.
   *
   * Quando vem de fora, este é o único campo de parcelas na tela — ter dois
   * lugares para dizer "10x" faz a pessoa duvidar de qual vale.
   */
  parcelas?: string;
  aoMudarParcelas?: (v: string) => void;
}) {
  const [aVista, setAVista] = useState('');
  const [parcelasLocal, setParcelasLocal] = useState('1');
  const [bandeira, setBandeira] = useState<Bandeira>('padrao');
  const [cobrado, setCobrado] = useState('');

  const parcelas = parcelasFora ?? parcelasLocal;
  const definirParcelas = aoMudarParcelas ?? setParcelasLocal;

  const base = aVista === '' ? (valorSugerido ?? 0) : Number(aVista) || 0;
  const nParcelas = Number(parcelas) || 1;
  const taxa = taxaDe(taxas, nParcelas, bandeira);

  /** O valor que devolve exatamente o preço à vista depois da taxa. */
  const sugerido = taxa != null ? valorNoCartao(base, taxa) : base;

  // Enquanto ninguém digita, vale a sugestão — o caso comum é aceitá-la.
  const valorFinal = cobrado === '' ? sugerido : Number(cobrado) || 0;
  const liquido = taxa != null ? liquidoRecebido(valorFinal, taxa) : valorFinal;
  const ganho = liquido - base;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
        <CreditCard className="h-4 w-4 text-accent" />
        Fechar valor no crédito
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Valor à vista"
          type="number"
          min={0}
          step="0.01"
          value={aVista}
          onChange={(e) => setAVista(e.target.value)}
          placeholder={valorSugerido ? String(valorSugerido.toFixed(2)) : '0,00'}
          hint="O preço sem cartão"
        />
        <Select
          label="Parcelas"
          value={parcelas}
          onChange={(e) => {
            definirParcelas(e.target.value);
            // Trocar o parcelamento muda a taxa: a sugestão volta a valer.
            setCobrado('');
          }}
          options={taxas.map((t) => ({
            value: String(t.parcelas),
            label:
              t.parcelas === 1
                ? 'À vista (1x)'
                : `${t.parcelas}x de ${formatCurrency(sugerido / t.parcelas)}`,
          }))}
        />
        <Select
          label="Bandeira"
          value={bandeira}
          onChange={(e) => {
            setBandeira(e.target.value as Bandeira);
            setCobrado('');
          }}
          options={[
            { value: 'padrao', label: 'Visa / Master / outras' },
            { value: 'elo', label: 'Elo / Amex' },
          ]}
        />
      </div>

      {base > 0 && taxa != null && (
        <div className="mt-3 space-y-2 rounded-lg bg-white px-3 py-2.5 dark:bg-navy-900">
          <p className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              A maquininha desconta {taxa.toFixed(2).replace('.', ',')}% em {nParcelas}x
              {bandeira === 'elo' ? ' (Elo/Amex)' : ''}
            </span>
            <span>− {formatCurrency(valorFinal - liquido)}</span>
          </p>

          <div className="flex items-end gap-2">
            <Input
              label="Cobrar do cliente"
              type="number"
              min={0}
              step="0.01"
              value={cobrado}
              onChange={(e) => setCobrado(e.target.value)}
              placeholder={sugerido.toFixed(2)}
              hint={`Sugestão: ${formatCurrency(sugerido)} — o que zera a taxa`}
              wrapperClassName="flex-1"
            />
            {cobrado !== '' && (
              <button
                type="button"
                onClick={() => setCobrado('')}
                className="mb-6 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:underline"
              >
                voltar à sugestão
              </button>
            )}
          </div>

          <p className="flex items-center justify-between border-t border-slate-100 pt-2 dark:border-navy-800">
            <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              A loja recebe
            </span>
            <strong className="text-2xl font-extrabold text-navy-900 dark:text-slate-50">
              {formatCurrency(liquido)}
            </strong>
          </p>

          <p className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{nParcelas > 1 ? `${nParcelas} parcelas de` : 'Parcela única de'}</span>
            <span>{formatCurrency(valorFinal / nParcelas)}</span>
          </p>

          {/* O número que separa um vendedor do outro: quanto ele conseguiu
              repassar além do que a maquininha cobra. */}
          <p
            className={cn(
              'flex items-center justify-between rounded px-2 py-1.5 text-xs font-semibold',
              Math.abs(ganho) < 0.01
                ? 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                : ganho > 0
                  ? 'bg-success-bg text-success dark:bg-success/15'
                  : 'bg-warning-bg text-warning dark:bg-warning/15',
            )}
          >
            <span className="flex items-center gap-1.5">
              {Math.abs(ganho) >= 0.01 &&
                (ganho > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
              {Math.abs(ganho) < 0.01
                ? 'Sai igual ao preço à vista'
                : ganho > 0
                  ? 'Acima do preço à vista'
                  : 'Abaixo do preço à vista — a loja banca a diferença'}
            </span>
            <span>
              {ganho > 0 ? '+' : ''}
              {formatCurrency(ganho)}
            </span>
          </p>

          {aoUsar && (
            <button
              type="button"
              onClick={() => aoUsar(valorFinal, nParcelas, taxa)}
              className={cn(
                'mt-1 w-full rounded-lg border border-accent px-3 py-2 text-sm font-semibold',
                'text-accent transition hover:bg-accent hover:text-white',
              )}
            >
              Usar {formatCurrency(valorFinal)} no pagamento
            </button>
          )}
        </div>
      )}

      {base > 0 && taxa == null && (
        <p className="mt-2 text-xs font-medium text-warning">
          Não há taxa cadastrada para {nParcelas}x. Ajuste em Configurações → Sistema.
        </p>
      )}
    </div>
  );
}
