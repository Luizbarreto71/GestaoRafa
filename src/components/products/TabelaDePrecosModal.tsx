import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useCategories } from '@/hooks/queries';
import { useUnit } from '@/contexts/UnitContext';
import { downloadFile } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/format';
import { CAMPOS } from '@shared/campos';
import { FileSpreadsheet, FileText, Loader2, Table } from 'lucide-react';
import { useState } from 'react';

/**
 * Gera a lista de preços que vai para as mãos dos vendedores.
 *
 * O preço sai do custo mais um acréscimo. Por padrão a lista **não** traz o
 * preço de compra — ela circula fora do escritório e mostrar o custo
 * entregaria a margem da loja.
 */
export function TabelaDePrecosModal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [acrescimo, setAcrescimo] = useState('100');
  const [categoryId, setCategoryId] = useState('');
  const [condicao, setCondicao] = useState('');
  const [unitId, setUnitId] = useState('');
  const [incluirCusto, setIncluirCusto] = useState(false);
  const [somenteComEstoque, setSomenteComEstoque] = useState(true);
  const [gerando, setGerando] = useState<string | null>(null);

  const toast = useToast();
  const { data: categorias } = useCategories();
  const { unidades } = useUnit();

  const valor = Number(acrescimo) || 0;

  async function gerar(formato: 'pdf' | 'xlsx' | 'csv') {
    setGerando(formato);
    try {
      await downloadFile(
        '/reports/price-list',
        {
          format: formato,
          markup: valor,
          categoryId,
          condicao,
          unitId,
          incluirCusto: incluirCusto ? 'true' : 'false',
          somenteComEstoque: somenteComEstoque ? 'true' : 'false',
        },
        `tabela-de-precos.${formato}`,
      );
      toast.success('Tabela gerada', `Preço = custo + ${formatCurrency(valor)}`);
    } catch {
      toast.error('Não foi possível gerar a tabela');
    } finally {
      setGerando(null);
    }
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Tabela de preços para os vendedores"
      description="Preço de compra + acréscimo, pronto para imprimir"
      size="md"
      footer={
        <Button variant="secondary" onClick={aoFechar}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <Input
            label="Acréscimo sobre o preço de compra"
            type="number"
            min={0}
            step="1"
            value={acrescimo}
            onChange={(e) => setAcrescimo(e.target.value)}
            hint="É o que soma ao custo para chegar no preço do vendedor"
          />

          <div className="mt-2 flex gap-2">
            {[50, 100, 150, 200].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAcrescimo(String(v))}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                  valor === v
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-navy-600 dark:text-slate-400 dark:hover:bg-navy-800',
                )}
              >
                +{formatCurrency(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-navy-800">
          <p className="text-slate-600 dark:text-slate-400">Exemplo de como sai:</p>
          <p className="mt-1 flex items-center justify-between">
            <span className="text-slate-500">Produto que você comprou por {formatCurrency(800)}</span>
            <strong className="text-lg text-success">{formatCurrency(800 + valor)}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={(categorias ?? []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Todas"
          />
          <Select
            label="Condição"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            options={(CAMPOS.condicao.opcoes ?? []).map((o) => ({ value: o, label: o }))}
            placeholder="Todas"
          />
          <Select
            label="Unidade"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            options={unidades.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Todas"
          />
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={somenteComEstoque}
              onChange={(e) => setSomenteComEstoque(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-accent"
            />
            <span className="text-slate-600 dark:text-slate-400">
              Só o que tem em estoque
              <span className="block text-xs text-slate-400">
                Evita o vendedor oferecer algo que já acabou
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={incluirCusto}
              onChange={(e) => setIncluirCusto(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-accent"
            />
            <span className="text-slate-600 dark:text-slate-400">
              Mostrar também o preço de compra
              <span className="block text-xs font-medium text-warning">
                Só para conferência sua — não entregue essa versão ao vendedor
              </span>
            </span>
          </label>
        </div>

        <div>
          <p className="label-base">Gerar</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { f: 'pdf' as const, rotulo: 'PDF para imprimir', icone: FileText },
                { f: 'xlsx' as const, rotulo: 'Excel', icone: FileSpreadsheet },
                { f: 'csv' as const, rotulo: 'CSV', icone: Table },
              ]
            ).map((op) => (
              <Button
                key={op.f}
                variant={op.f === 'pdf' ? 'primary' : 'outline'}
                disabled={Boolean(gerando)}
                onClick={() => void gerar(op.f)}
                icon={
                  gerando === op.f ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <op.icone className="h-4 w-4" />
                  )
                }
              >
                {op.rotulo}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
