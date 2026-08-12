import { Input, Select } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import {
  liquidoRecebido,
  taxaDe,
  TAXAS_PADRAO,
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
 * O que a venda no crédito rendeu.
 *
 * O vendedor já fechou o preço com o cliente, taxa embutida — a caixa só
 * digita o valor anotado. O que interessa depois é separar duas coisas que
 * viram uma só no extrato: quanto a maquininha levou, e quanto sobrou do
 * repasse acima do preço de tabela.
 */
export function CalculadoraDeCartao({
  taxas,
  aoUsar,
  valorSugerido,
  parcelas: parcelasFora,
  aoMudarParcelas,
  cobrado: cobradoFora,
  aoMudarCobrado,
}: {
  taxas: TaxaDeCartao[];
  /** Leva o valor fechado para o campo do pagamento. */
  aoUsar?: (valor: number, parcelas: number, taxa: number) => void;
  /** Preço de tabela dos produtos — a referência do que foi repassado. */
  valorSugerido?: number;
  parcelas?: string;
  aoMudarParcelas?: (v: string) => void;
  /** O valor que o vendedor anotou, já com a taxa embutida. */
  cobrado?: string;
  aoMudarCobrado?: (v: string) => void;
}) {
  const [parcelasLocal, setParcelasLocal] = useState('1');
  const [cobradoLocal, setCobradoLocal] = useState('');
  const [bandeira, setBandeira] = useState<Bandeira>('padrao');

  const parcelas = parcelasFora ?? parcelasLocal;
  const definirParcelas = aoMudarParcelas ?? setParcelasLocal;
  const cobrado = cobradoFora ?? cobradoLocal;
  const definirCobrado = aoMudarCobrado ?? setCobradoLocal;

  const nParcelas = Number(parcelas) || 1;
  const taxa = taxaDe(taxas, nParcelas, bandeira);

  const precoDeTabela = valorSugerido ?? 0;
  // Sem valor digitado, vale o preço de tabela — a venda sem repasse.
  const valorCobrado = cobrado === '' ? precoDeTabela : Number(cobrado) || 0;

  const liquido = taxa != null ? liquidoRecebido(valorCobrado, taxa) : valorCobrado;
  const custoDaTaxa = valorCobrado - liquido;
  const lucro = liquido - precoDeTabela;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
        <CreditCard className="h-4 w-4 text-accent" />
        Venda no crédito
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Valor combinado"
          type="number"
          min={0}
          step="0.01"
          value={cobrado}
          onChange={(e) => definirCobrado(e.target.value)}
          placeholder={precoDeTabela ? precoDeTabela.toFixed(2) : '0,00'}
          hint="O que o vendedor anotou, com a taxa"
          autoFocus
        />
        <Select
          label="Parcelas"
          value={parcelas}
          onChange={(e) => definirParcelas(e.target.value)}
          options={taxas.map((t) => ({
            value: String(t.parcelas),
            label:
              t.parcelas === 1
                ? 'À vista (1x)'
                : `${t.parcelas}x de ${formatCurrency(valorCobrado / t.parcelas)}`,
          }))}
        />
        <Select
          label="Bandeira"
          value={bandeira}
          onChange={(e) => setBandeira(e.target.value as Bandeira)}
          options={[
            { value: 'padrao', label: 'Visa / Master / outras' },
            { value: 'elo', label: 'Elo / Amex' },
          ]}
        />
      </div>

      {valorCobrado > 0 && taxa != null && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-white px-3 py-2.5 dark:bg-navy-900">
          <p className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Cliente paga</span>
            <span className="font-semibold text-navy-900 dark:text-slate-100">
              {formatCurrency(valorCobrado)}
              {nParcelas > 1 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  {nParcelas}× {formatCurrency(valorCobrado / nParcelas)}
                </span>
              )}
            </span>
          </p>

          {/* As duas linhas que o extrato junta e a loja precisa separada. */}
          <p className="flex justify-between text-sm text-danger">
            <span>
              Taxa da maquininha · {taxa.toFixed(2).replace('.', ',')}%
              {bandeira === 'elo' ? ' (Elo/Amex)' : ''}
            </span>
            <span className="font-semibold">− {formatCurrency(custoDaTaxa)}</span>
          </p>

          <p className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-navy-800">
            <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Cai na conta
            </span>
            <strong className="text-2xl font-extrabold text-navy-900 dark:text-slate-50">
              {formatCurrency(liquido)}
            </strong>
          </p>

          {precoDeTabela > 0 && (
            <p
              className={cn(
                'mt-1 flex items-center justify-between rounded px-2 py-1.5 text-xs font-semibold',
                Math.abs(lucro) < 0.01
                  ? 'bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400'
                  : lucro > 0
                    ? 'bg-success-bg text-success dark:bg-success/15'
                    : 'bg-warning-bg text-warning dark:bg-warning/15',
              )}
            >
              <span className="flex items-center gap-1.5">
                {Math.abs(lucro) >= 0.01 &&
                  (lucro > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ))}
                {Math.abs(lucro) < 0.01
                  ? 'O repasse cobriu exatamente a taxa'
                  : lucro > 0
                    ? 'Lucro no repasse da taxa'
                    : 'A loja bancou parte da taxa'}
              </span>
              <span>
                {lucro > 0 ? '+' : ''}
                {formatCurrency(lucro)}
              </span>
            </p>
          )}

          {aoUsar && (
            <button
              type="button"
              onClick={() => aoUsar(valorCobrado, nParcelas, taxa)}
              className={cn(
                'mt-1 w-full rounded-lg border border-accent px-3 py-2 text-sm font-semibold',
                'text-accent transition hover:bg-accent hover:text-white',
              )}
            >
              Usar {formatCurrency(valorCobrado)} no pagamento
            </button>
          )}
        </div>
      )}

      {valorCobrado > 0 && taxa == null && (
        <p className="mt-2 text-xs font-medium text-warning">
          Não há taxa cadastrada para {nParcelas}x. Ajuste em Configurações → Sistema.
        </p>
      )}
    </div>
  );
}
