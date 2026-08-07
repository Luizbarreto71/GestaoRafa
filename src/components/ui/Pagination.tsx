import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { PageMeta } from '@/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  meta?: PageMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

/** Gera a lista de páginas com reticências: 1 … 4 5 6 … 20 */
function pageItems(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) result.push('gap');
    result.push(page);
  });
  return result;
}

export function Pagination({ meta, onPageChange, onPageSizeChange }: PaginationProps) {
  if (!meta || meta.total === 0) return null;

  const { page, pageSize, total, totalPages } = meta;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-navy-700 sm:flex-row">
      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span>
          Exibindo <strong className="font-semibold text-navy-900 dark:text-slate-200">{from}</strong>–
          <strong className="font-semibold text-navy-900 dark:text-slate-200">{to}</strong> de{' '}
          <strong className="font-semibold text-navy-900 dark:text-slate-200">{formatNumber(total)}</strong>
        </span>

        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-navy-600 dark:bg-navy-800"
            aria-label="Itens por página"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </select>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginação">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-700"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pageItems(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition',
                  item === page
                    ? 'bg-navy-900 text-white dark:bg-accent'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-700',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-700"
            aria-label="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
