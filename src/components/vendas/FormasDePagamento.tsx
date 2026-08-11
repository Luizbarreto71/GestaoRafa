import { Input, Select } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatCurrency, PAYMENT_OPTIONS } from '@/lib/format';
import { Plus, Split, Trash2 } from 'lucide-react';

export type FormaDePagamento = {
  method: string;
  amount: string;
  installments: string;
  notes: string;
};

export const formaVazia = (method = 'PIX'): FormaDePagamento => ({
  method,
  amount: '',
  installments: '1',
  notes: '',
});

/** Quanto já foi distribuído entre as formas. */
export const somaDasFormas = (formas: FormaDePagamento[]) =>
  formas.reduce((soma, f) => soma + (Number(f.amount) || 0), 0);

/**
 * Monta o pagamento de uma venda, dividido ou não.
 *
 * O caso comum continua sendo um clique: forma única, valor implícito. A
 * divisão só aparece quando alguém pede, e aí o que sobra para distribuir
 * fica sempre à vista — no balcão, conferir de cabeça é o que gera erro de
 * caixa no fim do dia.
 */
export function FormasDePagamento({
  dividido,
  aoDividir,
  formas,
  aoMudarFormas,
  formaUnica,
  aoMudarFormaUnica,
  parcelas,
  aoMudarParcelas,
  total,
}: {
  dividido: boolean;
  aoDividir: (v: boolean) => void;
  formas: FormaDePagamento[];
  aoMudarFormas: (f: FormaDePagamento[]) => void;
  formaUnica: string;
  aoMudarFormaUnica: (v: string) => void;
  parcelas: string;
  aoMudarParcelas: (v: string) => void;
  /** Total da venda, para conferir o rateio. */
  total: number;
}) {
  const distribuido = somaDasFormas(formas);
  const falta = total - distribuido;

  const alterar = (i: number, mudanca: Partial<FormaDePagamento>) =>
    aoMudarFormas(formas.map((f, indice) => (indice === i ? { ...f, ...mudanca } : f)));

  function dividir() {
    aoDividir(true);
    // Primeira linha já com a forma escolhida e o total inteiro: quem só
    // quer separar em duas edita um valor e pronto.
    aoMudarFormas([
      { ...formaVazia(formaUnica), amount: total ? String(total.toFixed(2)) : '', installments: parcelas },
      formaVazia('DINHEIRO'),
    ]);
  }

  function juntar() {
    aoDividir(false);
    aoMudarFormas([]);
  }

  if (!dividido) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Forma de pagamento"
          required
          value={formaUnica}
          onChange={(e) => aoMudarFormaUnica(e.target.value)}
          options={PAYMENT_OPTIONS}
        />
        <Input
          label="Parcelas"
          type="number"
          min={1}
          max={24}
          value={parcelas}
          onChange={(e) => aoMudarParcelas(e.target.value)}
        />
        <div className="flex items-end">
          <button
            type="button"
            onClick={dividir}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            <Split className="h-4 w-4" />
            Dividir o pagamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
          <Split className="h-4 w-4 text-accent" />
          Pagamento dividido
        </p>
        <button
          type="button"
          onClick={juntar}
          className="text-xs font-semibold text-slate-500 hover:underline dark:text-slate-400"
        >
          Voltar para uma forma só
        </button>
      </div>

      <div className="space-y-2">
        {formas.map((f, i) => (
          <div key={i} className="flex items-end gap-2">
            <Select
              label={i === 0 ? 'Forma' : undefined}
              value={f.method}
              onChange={(e) => alterar(i, { method: e.target.value })}
              options={PAYMENT_OPTIONS}
              wrapperClassName="flex-1"
            />
            <Input
              label={i === 0 ? 'Valor' : undefined}
              type="number"
              min={0}
              step="0.01"
              placeholder="0,00"
              value={f.amount}
              onChange={(e) => alterar(i, { amount: e.target.value })}
              wrapperClassName="w-32"
            />
            <Input
              label={i === 0 ? 'Parc.' : undefined}
              type="number"
              min={1}
              max={24}
              value={f.installments}
              onChange={(e) => alterar(i, { installments: e.target.value })}
              wrapperClassName="w-20"
            />

            <button
              type="button"
              onClick={() => aoMudarFormas(formas.filter((_, indice) => indice !== i))}
              disabled={formas.length <= 2}
              className="mb-1 rounded p-2 text-danger transition hover:bg-danger-bg disabled:opacity-30 dark:hover:bg-danger/15"
              title={formas.length <= 2 ? 'Um pagamento dividido tem ao menos duas formas' : 'Remover'}
              aria-label="Remover forma"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {formas.length < 6 && (
          <button
            type="button"
            onClick={() => aoMudarFormas([...formas, formaVazia('DINHEIRO')])}
            className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Mais uma forma
          </button>
        )}

        {/* O que falta some quando fecha: é o sinal de que pode finalizar. */}
        {Math.abs(falta) >= 0.01 && (
          <button
            type="button"
            onClick={() =>
              alterar(formas.length - 1, {
                amount: ((Number(formas[formas.length - 1].amount) || 0) + falta).toFixed(2),
              })
            }
            className="text-xs font-semibold text-accent hover:underline"
          >
            Jogar o resto na última
          </button>
        )}
      </div>

      <div
        className={cn(
          'mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm',
          Math.abs(falta) < 0.01
            ? 'bg-success-bg text-success dark:bg-success/15'
            : 'bg-warning-bg text-warning dark:bg-warning/15',
        )}
      >
        <span className="font-semibold">
          {Math.abs(falta) < 0.01
            ? 'Fecha com o total da venda'
            : falta > 0
              ? 'Ainda falta distribuir'
              : 'Passou do total da venda'}
        </span>
        <strong>
          {Math.abs(falta) < 0.01
            ? formatCurrency(total)
            : `${formatCurrency(Math.abs(falta))} · de ${formatCurrency(total)}`}
        </strong>
      </div>
    </div>
  );
}

/** Traduz o que está na tela para o que a API espera. Null = forma única. */
export function paraApi(dividido: boolean, formas: FormaDePagamento[]) {
  if (!dividido) return undefined;

  return formas
    .filter((f) => (Number(f.amount) || 0) > 0)
    .map((f) => ({
      method: f.method,
      amount: Number(f.amount),
      installments: Number(f.installments) || 1,
      notes: f.notes.trim() || null,
    }));
}
