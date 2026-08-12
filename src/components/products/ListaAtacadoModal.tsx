import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useCategories } from '@/hooks/queries';
import { api } from '@/lib/api';
import { opcoesDeCategoria } from '@/lib/categorias';
import { cn } from '@/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Copy, Download, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

type Resposta = {
  texto: string;
  resumo: { modelos: number; pecas: number; grupos: number; semMarca: number };
  marcasParecidas: string[];
};

/**
 * Monta a lista diária de estoque pronta para mandar no grupo de atacado.
 *
 * Sai como texto — e não como PDF — porque em grupo de WhatsApp ninguém abre
 * anexo. O asterisco vira negrito no aplicativo, então os títulos de marca
 * chegam destacados do outro lado.
 */
export function ListaAtacadoModal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [preco, setPreco] = useState<'atacado' | 'varejo' | 'custo'>('atacado');
  const [markup, setMarkup] = useState('100');
  const [agruparPor, setAgruparPor] = useState<'marca' | 'categoria'>('marca');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [mostrarQuantidade, setMostrarQuantidade] = useState(true);
  const [mostrarCondicao, setMostrarCondicao] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [copiado, setCopiado] = useState(false);

  const toast = useToast();
  const { data: categorias } = useCategories();
  const { unidades } = useUnit();

  const parametros = {
    preco,
    markup: Number(markup) || 0,
    agruparPor,
    categoryId,
    unitId,
    mostrarQuantidade: String(mostrarQuantidade),
    mostrarCondicao: String(mostrarCondicao),
    titulo,
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['lista-atacado', parametros],
    enabled: aberto,
    queryFn: async () => {
      const limpos = Object.fromEntries(Object.entries(parametros).filter(([, v]) => v !== ''));
      const { data } = await api.get<Resposta>('/reports/whatsapp-list', { params: limpos });
      return data;
    },
  });

  async function copiar() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
      toast.success('Lista copiada', 'Agora é só colar no grupo');
    } catch {
      toast.error('Não deu para copiar', 'Selecione o texto e copie manualmente');
    }
  }

  function baixar() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([data.texto], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lista-atacado-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      open={aberto}
      onClose={aoFechar}
      title="Lista para o grupo de atacado"
      description="Todo o estoque separado por marca, pronto para colar no WhatsApp"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button variant="outline" onClick={baixar} disabled={!data} icon={<Download className="h-4 w-4" />}>
            Baixar .txt
          </Button>
          <Button
            onClick={() => void copiar()}
            disabled={!data}
            icon={copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          >
            {copiado ? 'Copiado!' : 'Copiar lista'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Preço que vai na lista"
            value={preco}
            onChange={(e) => setPreco(e.target.value as typeof preco)}
            options={[
              { value: 'atacado', label: 'Preço de atacado' },
              { value: 'varejo', label: 'Preço de varejo' },
              { value: 'custo', label: 'Preço de compra + acréscimo' },
            ]}
          />
          <Select
            label="Separar por"
            value={agruparPor}
            onChange={(e) => setAgruparPor(e.target.value as typeof agruparPor)}
            options={[
              { value: 'marca', label: 'Marca' },
              { value: 'categoria', label: 'Categoria' },
            ]}
          />
        </div>

        {preco === 'custo' && (
          <Input
            label="Acréscimo sobre o preço de compra"
            type="number"
            min={0}
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            hint="Cuidado: essa versão parte do seu custo"
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={opcoesDeCategoria(categorias)}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Título da mensagem"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="RAFA MULTIMARCAS"
          />
          <div className="flex flex-col justify-end gap-1.5 pb-1">
            {[
              { ligado: mostrarQuantidade, mudar: setMostrarQuantidade, texto: 'Mostrar a quantidade de cada item' },
              { ligado: mostrarCondicao, mudar: setMostrarCondicao, texto: 'Mostrar a condição (lacrado, vitrine…)' },
            ].map((op) => (
              <label key={op.texto} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={op.ligado}
                  onChange={(e) => op.mudar(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-accent"
                />
                <span className="text-slate-600 dark:text-slate-400">{op.texto}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Marcas escritas de dois jeitos viram dois títulos na lista. */}
        {data && data.marcasParecidas.length > 0 && (
          <div className="flex gap-2.5 rounded-lg bg-warning-bg px-4 py-3 text-sm dark:bg-warning/10">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p className="text-slate-700 dark:text-slate-300">
              Estas marcas parecem ser a mesma escrita de jeitos diferentes:{' '}
              <strong>{data.marcasParecidas.join(', ')}</strong>. Elas saem em grupos separados — corrija o
              cadastro para juntar.
            </p>
          </div>
        )}

        {data && data.resumo.semMarca > 0 && agruparPor === 'marca' && (
          <div className="flex gap-2.5 rounded-lg bg-slate-100 px-4 py-3 text-sm dark:bg-navy-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-slate-600 dark:text-slate-400">
              {data.resumo.semMarca} produto(s) estão sem marca no cadastro e saem no fim, em “Outros”.
            </p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label-base mb-0">Como vai chegar no grupo</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Atualizar
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-[#0b141a] p-4 dark:border-navy-700">
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Montando a lista…
              </div>
            ) : (
              <div className="rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-white">
                <pre className="whitespace-pre-wrap break-words font-sans">
                  {(data?.texto ?? '').split('*').map((parte, i) =>
                    i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte,
                  )}
                </pre>
              </div>
            )}
          </div>

          {data && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MessageCircle className="h-3.5 w-3.5" />
              {data.resumo.modelos} modelos · {data.resumo.pecas} peças · {data.resumo.grupos} grupos
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
