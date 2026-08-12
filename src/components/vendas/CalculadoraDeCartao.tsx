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
import { CreditCard } from 'lucide-react';
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
 * Quanto cobrar no cartão para a loja receber o valor combinado à vista.
 *
 * O caixa digita o preço à vista, escolhe as parcelas e a bandeira; a conta
 * aparece aberta. Sem isso, ou se cobra o preço à vista e a loja come a
 * taxa, ou se faz a conta de cabeça no balcão — e as duas dão errado.
 */
export function CalculadoraDeCartao({
  taxas,
  aoUsar,
  valorSugerido,
}: {
  taxas: TaxaDeCartao[];
  /** Leva o valor calculado para o campo do pagamento. */
  aoUsar?: (valor: number, parcelas: number) => void;
  /** Total do carrinho, para começar preenchido. */
  valorSugerido?: number;
}) {
  const [aVista, setAVista] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [bandeira, setBandeira] = useState<Bandeira>('padrao');

  const base = aVista === '' ? (valorSugerido ?? 0) : Number(aVista) || 0;
  const nParcelas = Number(parcelas) || 1;
  const taxa = taxaDe(taxas, nParcelas, bandeira);

  const cobrar = taxa != null ? valorNoCartao(base, taxa) : base;
  const recebe = taxa != null ? liquidoRecebido(cobrar, taxa) : base;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
        <CreditCard className="h-4 w-4 text-accent" />
        Quanto cobrar no cartão
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
          hint="O que a loja quer receber"
        />
        <Select
          label="Parcelas"
          value={parcelas}
          onChange={(e) => setParcelas(e.target.value)}
          options={taxas.map((t) => ({
            value: String(t.parcelas),
            label: `${t.parcelas}x`,
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

      {base > 0 && taxa != null && (
        <div className="mt-3 space-y-1 rounded-lg bg-white px-3 py-2.5 dark:bg-navy-900">
          <p className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              Taxa de {nParcelas}x {bandeira === 'elo' ? '(Elo/Amex)' : ''}
            </span>
            <span>{taxa.toFixed(2).replace('.', ',')}%</span>
          </p>

          <p className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-navy-800">
            <span className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Cobrar no cartão
            </span>
            <strong className="text-2xl font-extrabold text-navy-900 dark:text-slate-50">
              {formatCurrency(cobrar)}
            </strong>
          </p>

          <p className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{nParcelas > 1 ? `${nParcelas} parcelas de` : 'Parcela única de'}</span>
            <span>{formatCurrency(cobrar / nParcelas)}</span>
          </p>

          {/* A prova de que a conta fecha: o líquido tem de bater com o
              valor à vista, senão a taxa está saindo do bolso da loja. */}
          <p className="flex justify-between text-xs text-success">
            <span>A loja recebe</span>
            <span className="font-semibold">{formatCurrency(recebe)}</span>
          </p>

          {aoUsar && (
            <button
              type="button"
              onClick={() => aoUsar(cobrar, nParcelas)}
              className={cn(
                'mt-2 w-full rounded-lg border border-accent px-3 py-2 text-sm font-semibold',
                'text-accent transition hover:bg-accent hover:text-white',
              )}
            >
              Usar {formatCurrency(cobrar)} no pagamento
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
