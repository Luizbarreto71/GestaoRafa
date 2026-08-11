import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
import { useProducts } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import type { ItemVenda, Product } from '@/types';
import { Package, Plus, Search, Trash2 } from 'lucide-react';
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

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => acrescentar(p)}
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-0 hover:bg-slate-50 dark:border-navy-700 dark:hover:bg-navy-800"
                  >
                    <Plus className="h-4 w-4 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900 dark:text-slate-100">
                        {p.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {[p.condicao, p.imei && `IMEI ${p.imei}`].filter(Boolean).join(' · ') ||
                          p.category?.name}
                      </span>
                    </span>
                    <Badge tone={livre > 0 ? 'success' : 'danger'}>{livre} un.</Badge>
                    <span className="shrink-0 text-sm font-semibold text-navy-900 dark:text-slate-100">
                      {formatCurrency(p.salePrice || p.wholesalePrice || 0)}
                    </span>
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
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                      {item.productName ?? item.product?.name}
                    </p>
                    {item.disponivel != null && (
                      <p className={cn('text-xs', semSaldo ? 'font-semibold text-danger' : 'text-slate-500')}>
                        {semSaldo
                          ? `Só há ${item.disponivel} em estoque`
                          : `${item.disponivel} disponível(is)`}
                      </p>
                    )}
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

/** Soma dos itens — usada pelas telas para mostrar o total antes de salvar. */
export const totalDosItens = (itens: ItemVenda[]) =>
  itens.reduce((soma, i) => soma + i.unitPrice * i.quantity, 0);
