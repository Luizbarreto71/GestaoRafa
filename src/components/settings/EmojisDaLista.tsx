import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/contexts/ToastContext';
import { useCategories } from '@/hooks/queries';
import { api, getErrorMessage } from '@/lib/api';
import { emojiSugerido } from '@shared/lista-atacado';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, Smile } from 'lucide-react';
import { useEffect, useState } from 'react';

/** O emoji escolhido para cada categoria, por id. */
export const useEmojisDeCategoria = () =>
  useQuery({
    queryKey: ['emojis-categoria'],
    queryFn: async () => {
      const { data } = await api.get<{ emojis: Record<string, string> }>(
        '/settings/emojis-categoria',
      );
      return data.emojis;
    },
    staleTime: 5 * 60_000,
  });

/**
 * O emoji que cada categoria leva na lista do grupo de atacado.
 *
 * É o símbolo que abre o bloco e repete em cada produto. O sistema já
 * chuta um pelo nome da categoria — esta tela existe para quando o chute
 * não serve, e para quando a loja quiser outro.
 */
export function EmojisDaLista() {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: categorias } = useCategories();
  const { data: salvos } = useEmojisDeCategoria();

  useEffect(() => {
    if (salvos) setEscolhas(salvos);
  }, [salvos]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { data } = await api.put<{ message: string }>('/settings/emojis-categoria', {
        emojis: escolhas,
      });
      return data;
    },
    onSuccess: (r) => {
      toast.success('Emojis salvos', r.message);
      void queryClient.invalidateQueries({ queryKey: ['emojis-categoria'] });
      void queryClient.invalidateQueries({ queryKey: ['lista-atacado'] });
    },
    onError: (e) => toast.error('Não foi possível salvar', getErrorMessage(e)),
  });

  const lista = (categorias ?? []).slice().sort((a, b) => {
    const ordem = (a.ordem ?? 0) - (b.ordem ?? 0);
    return ordem !== 0 ? ordem : a.name.localeCompare(b.name, 'pt-BR');
  });

  return (
    <Card>
      <CardHeader
        title="Emojis da lista de atacado"
        subtitle="O símbolo que abre cada categoria no grupo do WhatsApp"
        action={
          <Button
            loading={salvar.isPending}
            onClick={() => salvar.mutate()}
            icon={<Save className="h-4 w-4" />}
          >
            Salvar
          </Button>
        }
      />

      <CardBody className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:bg-navy-800 dark:text-slate-400">
          Deixe em branco para o sistema escolher pelo nome da categoria — “JBL” vira 🔉,
          “Celulares” vira 📱. O que você digitar aqui tem preferência.
        </div>

        {lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma categoria cadastrada.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {lista.map((categoria) => {
              const escolhido = escolhas[categoria.id] ?? '';
              const sugerido = emojiSugerido(categoria.name);

              return (
                <div
                  key={categoria.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-navy-700"
                >
                  <input
                    value={escolhido}
                    onChange={(e) =>
                      setEscolhas((atual) => ({ ...atual, [categoria.id]: e.target.value }))
                    }
                    placeholder={sugerido}
                    maxLength={8}
                    aria-label={`Emoji de ${categoria.name}`}
                    className="h-11 w-14 shrink-0 rounded-lg border border-slate-200 bg-white text-center text-xl dark:border-navy-700 dark:bg-navy-900"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-900 dark:text-slate-100">
                      {categoria.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {escolhido ? 'escolhido por você' : `sugerido: ${sugerido}`}
                    </p>
                  </div>

                  {escolhido && (
                    <button
                      type="button"
                      title="Voltar ao sugerido"
                      onClick={() =>
                        setEscolhas((atual) => {
                          const { [categoria.id]: _fora, ...resto } = atual;
                          return resto;
                        })
                      }
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-navy-800"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Smile className="h-3.5 w-3.5" />
          Copie o emoji de onde quiser e cole no quadrinho — vale qualquer um.
        </p>
      </CardBody>
    </Card>
  );
}
