import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { ARMAZENAMENTOS } from '@shared/trocas';
import { Plus, Repeat2, Trash2, X } from 'lucide-react';

/** Um aparelho recebido na troca, como a caixa anota. */
export type AparelhoDeBalcao = {
  modelo: string;
  cor: string;
  armazenamento: string;
  valorAvaliado: string;
};

/** A troca inteira: o cliente pode entregar mais de um aparelho. */
export type TrocaDeBalcao = AparelhoDeBalcao[];

export const aparelhoVazio = (): AparelhoDeBalcao => ({
  modelo: '',
  cor: '',
  armazenamento: '',
  valorAvaliado: '',
});

export const trocaVazia = (): TrocaDeBalcao => [aparelhoVazio()];

/** Quanto a troca abate da compra. */
export const totalDaTroca = (t: TrocaDeBalcao) =>
  t.reduce((soma, a) => soma + (Number(a.valorAvaliado) || 0), 0);

/** O que a API espera. Null quando não há aparelho na negociação. */
export function trocaParaApi(ligada: boolean, t: TrocaDeBalcao) {
  if (!ligada) return null;

  const validos = t.filter((a) => a.modelo.trim() && (Number(a.valorAvaliado) || 0) > 0);
  if (!validos.length) return null;

  return validos.map((a) => ({
    modelo: a.modelo.trim(),
    cor: a.cor.trim() || null,
    armazenamento: a.armazenamento.trim() || null,
    valorAvaliado: Number(a.valorAvaliado) || 0,
  }));
}

/**
 * Aparelhos recebidos como parte do pagamento, anotados no balcão.
 *
 * Bem mais curto que a avaliação do vendedor: com o cliente na frente e
 * fila atrás, a caixa anota o que identifica cada aparelho e quanto vale.
 * O IMEI, a consulta da Anatel e as fotos ficam para o cadastro no estoque
 * — cobrar isso aqui travaria o caixa.
 */
export function TrocaNoBalcao({
  ligada,
  aoLigar,
  troca,
  aoMudar,
  totalDosProdutos,
}: {
  ligada: boolean;
  aoLigar: (v: boolean) => void;
  troca: TrocaDeBalcao;
  aoMudar: (t: TrocaDeBalcao) => void;
  totalDosProdutos: number;
}) {
  const avaliado = totalDaTroca(troca);
  const aPagar = Math.max(0, totalDosProdutos - avaliado);
  const passou = avaliado > totalDosProdutos;

  const alterar = (i: number, campo: keyof AparelhoDeBalcao, valor: string) =>
    aoMudar(troca.map((a, n) => (n === i ? { ...a, [campo]: valor } : a)));

  if (!ligada) {
    return (
      <button
        type="button"
        onClick={() => aoLigar(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:border-accent hover:bg-accent/5 hover:text-accent dark:border-navy-600 dark:text-slate-400"
      >
        <Repeat2 className="h-4 w-4" />
        O cliente deixou um aparelho na troca
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-navy-900 dark:text-slate-100">
          <Repeat2 className="h-4 w-4 text-accent" />
          {troca.length === 1 ? 'Aparelho na troca' : `${troca.length} aparelhos na troca`}
        </p>
        <button
          type="button"
          onClick={() => {
            aoLigar(false);
            aoMudar(trocaVazia());
          }}
          className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
          aria-label="Tirar a troca da venda"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {troca.map((aparelho, i) => (
          <div
            key={i}
            className={cn(
              troca.length > 1 && 'rounded-lg border border-accent/30 bg-white/60 p-2.5 dark:bg-navy-900/40',
            )}
          >
            {troca.length > 1 && (
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => aoMudar(troca.filter((_, n) => n !== i))}
                  className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                  aria-label={`Tirar o aparelho ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input
                label="Modelo"
                required
                value={aparelho.modelo}
                onChange={(e) => alterar(i, 'modelo', e.target.value)}
                placeholder="iPhone 12, Redmi Note 13…"
                wrapperClassName="sm:col-span-2"
                autoFocus={i > 0}
              />
              <div>
                <Input
                  label="GB"
                  value={aparelho.armazenamento}
                  onChange={(e) => alterar(i, 'armazenamento', e.target.value)}
                  placeholder="128GB"
                  list="gigas-balcao"
                />
              </div>
              <Input
                label="Cor"
                value={aparelho.cor}
                onChange={(e) => alterar(i, 'cor', e.target.value)}
                placeholder="Preto"
              />
            </div>

            <div className="mt-2">
              <Input
                label="Quanto vale o aparelho dele"
                type="number"
                min={0}
                step="0.01"
                required
                value={aparelho.valorAvaliado}
                onChange={(e) => alterar(i, 'valorAvaliado', e.target.value)}
                hint={troca.length === 1 ? 'Vira forma de pagamento — o cliente paga só a diferença' : undefined}
              />
            </div>
          </div>
        ))}

        <datalist id="gigas-balcao">
          {ARMAZENAMENTOS.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>

        {/* Até seis: mais que isso não é troca de balcão, é compra de lote,
            e essa tem caminho próprio pela aba Seminovos. */}
        {troca.length < 6 && (
          <button
            type="button"
            onClick={() => aoMudar([...troca, aparelhoVazio()])}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/50 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Ele deixou mais um aparelho
          </button>
        )}
      </div>

      {/* A conta que o cliente quer ouvir, feita à vista de todos. */}
      <div
        className={cn(
          'mt-3 rounded-lg px-3 py-2.5',
          passou ? 'bg-warning-bg dark:bg-warning/15' : 'bg-navy-900 text-white dark:bg-navy-800',
        )}
      >
        <p className={cn('flex justify-between text-sm', passou && 'text-warning')}>
          <span className={passou ? '' : 'text-slate-300'}>Aparelhos</span>
          <span>{formatCurrency(totalDosProdutos)}</span>
        </p>
        <p className={cn('mt-1 flex justify-between text-sm', passou && 'text-warning')}>
          <span className={passou ? '' : 'text-slate-300'}>
            {troca.length === 1 ? 'Troca do cliente' : `Troca do cliente · ${troca.length} aparelhos`}
          </span>
          <span className={passou ? '' : 'text-success-soft'}>− {formatCurrency(avaliado)}</span>
        </p>
        <p
          className={cn(
            'mt-2 flex items-center justify-between border-t pt-2',
            passou ? 'border-warning/30 text-warning' : 'border-white/15',
          )}
        >
          <span className="font-semibold">
            {passou ? 'A troca vale mais que a compra' : 'O cliente paga'}
          </span>
          <strong className="text-2xl font-extrabold">
            {passou ? formatCurrency(avaliado - totalDosProdutos) : formatCurrency(aPagar)}
          </strong>
        </p>
      </div>

      {passou && (
        <p className="mt-2 text-xs font-medium text-warning">
          O sistema não registra venda com valor negativo. Ajuste a avaliação ou acrescente produtos.
        </p>
      )}
    </div>
  );
}
