import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { useProducts } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { ItemVenda, Product } from '@/types';
import { Check, ImageOff, Package, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Monta a lista de produtos de uma venda ou pré-venda.
 *
 * É o mesmo componente nas duas telas: o vendedor monta a intenção e o
 * caixa monta a venda no balcão. O que muda é só o que acontece depois.
 */
export function CarrinhoDeItens({
  itens,
  aoMudar,
  unidadeId,
  somenteLeitura,
}: {
  itens: ItemVenda[];
  aoMudar: (itens: ItemVenda[]) => void;
  /** Quando informada, mostra o saldo do produto naquela unidade. */
  unidadeId?: string;
  somenteLeitura?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const termo = useDebounce(busca, 300);
  const { data } = useProducts({ search: termo, pageSize: 6 });

  const total = itens.reduce((soma, i) => soma + i.unitPrice * i.quantity, 0);

  function acrescentar(produto: Product) {
    const linha = produto.stock?.find((s) => s.unitId === unidadeId);

    aoMudar([
      ...itens,
      {
        productId: produto.id,
        productName: produto.name,
        quantity: 1,
        // Começa no preço de varejo; sem ele, no de atacado.
        unitPrice: produto.salePrice || produto.wholesalePrice || 0,
        imei: produto.imei ?? '',
        serialNumber: produto.serialNumber ?? '',
        disponivel: linha?.available ?? linha?.quantity ?? null,
        // Só para a tela: a API ignora, mas é o que deixa o carrinho
        // conferível de relance quando o cliente leva várias coisas.
        foto: produto.photos?.[0] ?? null,
        detalhes: [produto.brand, produto.capacity, produto.color, produto.condicao]
          .filter(Boolean)
          .join(' · '),
        product: { id: produto.id, name: produto.name, model: produto.model },
      },
    ]);
    setBusca('');
  }

  const alterar = (indice: number, mudanca: Partial<ItemVenda>) =>
    aoMudar(itens.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));

  const remover = (indice: number) => aoMudar(itens.filter((_, i) => i !== indice));

  return (
    <div className="space-y-3">
      {!somenteLeitura && (
        <div>
          <Input
            label="Adicionar produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, IMEI, modelo, número de série…"
            icon={<Search className="h-4 w-4" />}
          />

          {termo.length >= 2 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
              {data?.data.length === 0 && (
                <p className="px-3 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nada encontrado para “{termo}”
                </p>
              )}

              {data?.data.map((p) => {
                const linha = p.stock?.find((s) => s.unitId === unidadeId);
                const livre = linha?.available ?? linha?.quantity ?? p.quantity;

                // Quantas vezes este produto já está no carrinho: o cliente
                // que leva três iguais precisa ver que já foram lançados.
                const jaNoCarrinho = itens
                  .filter((i) => i.productId === p.id)
                  .reduce((n, i) => n + i.quantity, 0);

                // O que diferencia um modelo do outro na prateleira.
                const detalhes = [p.brand, p.capacity, p.color, p.condicao].filter(Boolean).join(' · ');

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => acrescentar(p)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-2 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800"
                  >
                    <FotoDoProduto produto={p} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {detalhes || p.category?.name}
                      </span>
                      {p.imei && (
                        <span className="block truncate font-mono text-[11px] text-slate-400">
                          IMEI {p.imei}
                        </span>
                      )}
                      {jaNoCarrinho > 0 && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent">
                          <Check className="h-3 w-3" />
                          {jaNoCarrinho} já no carrinho
                        </span>
                      )}
                    </span>

                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold text-navy-900 dark:text-slate-100">
                        {formatCurrency(p.salePrice || p.wholesalePrice || 0)}
                      </span>
                      <Badge tone={livre > 0 ? 'success' : 'danger'}>{livre} un.</Badge>
                    </span>

                    <Plus className="h-4 w-4 shrink-0 text-accent" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-navy-600">
          <Package className="h-7 w-7 text-slate-300 dark:text-navy-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum produto ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((item, indice) => {
            const semSaldo = item.disponivel != null && item.quantity > item.disponivel;

            return (
              <div
                key={`${item.productId}-${indice}`}
                className={cn(
                  'rounded-lg border p-3',
                  semSaldo
                    ? 'border-danger/40 bg-danger-bg/40 dark:bg-danger/10'
                    : 'border-slate-200 bg-slate-50 dark:border-navy-700 dark:bg-navy-800',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    {item.foto && (
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-600">
                        <img
                          src={item.foto}
                          alt={item.productName ?? ''}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </span>
                    )}

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                        {item.productName ?? item.product?.name}
                      </p>
                      {item.detalhes && (
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {item.detalhes}
                        </p>
                      )}
                      {item.disponivel != null && (
                        <p className={cn('text-xs', semSaldo ? 'font-semibold text-danger' : 'text-slate-500')}>
                          {semSaldo
                            ? `Só há ${item.disponivel} em estoque`
                            : `${item.disponivel} disponível(is)`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-success">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                    {!somenteLeitura && (
                      <button
                        type="button"
                        onClick={() => remover(indice)}
                        className="rounded p-1 text-danger transition hover:bg-danger-bg dark:hover:bg-danger/15"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input
                    label="Qtd"
                    type="number"
                    min={1}
                    value={String(item.quantity)}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(indice, { quantity: Number(e.target.value) || 1 })}
                  />
                  <Input
                    label="Valor unit."
                    type="number"
                    min={0}
                    step="0.01"
                    value={String(item.unitPrice)}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(indice, { unitPrice: Number(e.target.value) || 0 })}
                  />
                  <Input
                    label="IMEI"
                    value={item.imei ?? ''}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(indice, { imei: e.target.value })}
                    placeholder="opcional"
                  />
                  <Input
                    label="Nº de série"
                    value={item.serialNumber ?? ''}
                    disabled={somenteLeitura}
                    onChange={(e) => alterar(indice, { serialNumber: e.target.value })}
                    placeholder="opcional"
                  />
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between rounded-lg bg-navy-900 px-4 py-3 text-white dark:bg-navy-800">
            <span className="text-sm font-semibold">
              Total · {itens.reduce((n, i) => n + i.quantity, 0)} item(ns)
            </span>
            <span className="text-xl font-extrabold">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Miniatura do produto na busca e no carrinho.
 *
 * Nome de celular muda por uma palavra — "15 PRO 128GB" e "15 PRO MAX
 * 128GB" —, e no balcão a foto é o que confirma num relance que o item
 * lançado é o que está na mão do cliente.
 */
function FotoDoProduto({ produto }: { produto: Product }) {
  const foto = produto.photos?.[0];

  if (!foto) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-700">
        <ImageOff className="h-4 w-4 text-slate-300 dark:text-navy-500" />
      </span>
    );
  }

  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-navy-600">
      <img src={foto} alt={produto.name} className="h-full w-full object-cover" loading="lazy" />
    </span>
  );
}

/** Soma dos itens — usada pelas telas para mostrar o total antes de salvar. */
export const totalDosItens = (itens: ItemVenda[]) =>
  itens.reduce((soma, i) => soma + i.unitPrice * i.quantity, 0);
