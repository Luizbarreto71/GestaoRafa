import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/contexts/ToastContext';
import { useUnit } from '@/contexts/UnitContext';
import { useCategories } from '@/hooks/queries';
import { api } from '@/lib/api';
import { opcoesDeCategoria } from '@/lib/categorias';
import { cn } from '@/lib/cn';
import { useQuery } from '@tanstack/react-query';
import { Check, Download, Loader2, MessageCircle } from 'lucide-react';
import { useState } from 'react';

type Resposta = {
  texto: string;
  resumo: { linhas: number; categorias: number; juntados: number };
};

/**
 * Monta a lista diária pronta para colar no grupo de atacado.
 *
 * Sai como texto — e não como PDF — porque em grupo de WhatsApp ninguém
 * abre anexo. O que aparece no quadro escuro é exatamente o que chega do
 * outro lado: cada quebra de linha e cada ponto e vírgula fazem parte do
 * resultado, então nada aqui reformata o texto para exibir.
 */
export function ListaAtacadoModal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const toast = useToast();
  const { data: categorias } = useCategories();
  const { unidades } = useUnit();

  const parametros = { categoryId, unitId, somenteDisponiveis: String(somenteDisponiveis) };

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
      // Sem tocar em nada: o texto é o produto final.
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
      description="Todo o estoque separado por categoria, pronto para colar no WhatsApp"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={baixar}
            disabled={!data}
            icon={<Download className="h-4 w-4" />}
          >
            Baixar .txt
          </Button>
          <Button
            onClick={() => void copiar()}
            disabled={!data}
            icon={copiado ? <Check className="h-4 w-4" /> : undefined}
          >
            {copiado ? 'Copiado!' : '📋 COPIAR LISTA'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={somenteDisponiveis}
            onChange={(e) => setSomenteDisponiveis(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-accent"
          />
          <span className="text-slate-600 dark:text-slate-400">
            Mostrar somente o que está disponível no estoque
          </span>
        </label>

        <Button
          onClick={() => void refetch()}
          loading={isFetching}
          className="w-full"
        >
          📋 GERAR LISTA
        </Button>

        <div>
          <p className="label-base">Como vai chegar no grupo</p>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-[#0b141a] p-4 dark:border-navy-700">
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Montando a lista…
              </div>
            ) : (
              <div className="rounded-lg rounded-tl-none bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-white">
                <pre className="whitespace-pre-wrap break-words font-sans">{data?.texto ?? ''}</pre>
              </div>
            )}
          </div>

          {data && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MessageCircle className="h-3.5 w-3.5" />
              {data.resumo.linhas} linhas · {data.resumo.categorias}{' '}
              {data.resumo.categorias === 1 ? 'categoria' : 'categorias'}
              {data.resumo.juntados > 0 && (
                <span className={cn('text-slate-400')}>
                  · {data.resumo.juntados} repetição(ões) de cor juntadas
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
