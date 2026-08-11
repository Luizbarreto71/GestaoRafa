import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { ARMAZENAMENTOS } from '@shared/trocas';
import { Repeat2, X } from 'lucide-react';

export type TrocaDeBalcao = {
  modelo: string;
  cor: string;
  armazenamento: string;
  valorAvaliado: string;
};

export const trocaVazia = (): TrocaDeBalcao => ({
  modelo: '',
  cor: '',
  armazenamento: '',
  valorAvaliado: '',
});

/** O que a API espera. Null quando não há aparelho na negociação. */
export function trocaParaApi(ligada: boolean, t: TrocaDeBalcao) {
  const valor = Number(t.valorAvaliado) || 0;
  if (!ligada || !t.modelo.trim() || valor <= 0) return null;

  return {
    modelo: t.modelo.trim(),
    cor: t.cor.trim() || null,
    armazenamento: t.armazenamento.trim() || null,
    valorAvaliado: valor,
  };
}

/**
 * Aparelho recebido como parte do pagamento, anotado no balcão.
 *
 * Bem mais curto que a avaliação do vendedor: com o cliente na frente e
 * fila atrás, a caixa anota o que identifica o aparelho e quanto vale. O
 * IMEI, a consulta da Anatel e as fotos ficam para o cadastro no estoque —
 * cobrar isso aqui travaria o caixa.
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
  const avaliado = Number(troca.valorAvaliado) || 0;
  const aPagar = Math.max(0, totalDosProdutos - avaliado);
  const passou = avaliado > totalDosProdutos;

  const alterar = (campo: keyof TrocaDeBalcao, valor: string) =>
    aoMudar({ ...troca, [campo]: valor });

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
          Aparelho na troca
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Input
          label="Modelo"
          required
          value={troca.modelo}
          onChange={(e) => alterar('modelo', e.target.value)}
          placeholder="iPhone 12, Redmi Note 13…"
          wrapperClassName="sm:col-span-2"
        />
        <div>
          <Input
            label="GB"
            value={troca.armazenamento}
            onChange={(e) => alterar('armazenamento', e.target.value)}
            placeholder="128GB"
            list="gigas-balcao"
          />
          <datalist id="gigas-balcao">
            {ARMAZENAMENTOS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <Input
          label="Cor"
          value={troca.cor}
          onChange={(e) => alterar('cor', e.target.value)}
          placeholder="Preto"
        />
      </div>

      <div className="mt-3">
        <Input
          label="Quanto vale o aparelho dele"
          type="number"
          min={0}
          step="0.01"
          required
          value={troca.valorAvaliado}
          onChange={(e) => alterar('valorAvaliado', e.target.value)}
          hint="Vira forma de pagamento — o cliente paga só a diferença"
        />
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
          <span className={passou ? '' : 'text-slate-300'}>Troca do cliente</span>
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
