import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategories, useCrudMutation } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { categoryService } from '@/services';
import type { Category } from '@/types';
import {
  CAMPOS,
  normalizarCampos,
  rotuloDoCampo,
  TODAS_AS_CHAVES,
  type CampoDaCategoria,
  type ChaveCampo,
} from '@shared/campos';
import { PALETA_DE_CATEGORIAS } from '@shared/cores';
import { ChevronDown, GripVertical, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Monta o formulário de cada categoria: quais campos aparecem, com que nome
 * e quais são obrigatórios.
 */
export function CategoriesTab() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data: categorias, isLoading } = useCategories();
  const [aberta, setAberta] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Apenas administradores podem mudar os formulários.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Cada categoria tem seu próprio formulário de cadastro. Marque só o que faz sentido — o que
        estiver desmarcado some da tela de cadastro daquela categoria.
      </p>

      {isLoading && <div className="skeleton h-24 w-full" />}

      {categorias?.map((categoria) => (
        <EditorDeCategoria
          key={categoria.id}
          categoria={categoria}
          outras={(categorias ?? []).filter((c) => c.id !== categoria.id)}
          aberta={aberta === categoria.id}
          onAlternar={() => setAberta(aberta === categoria.id ? null : categoria.id)}
          onSalvo={() => toast.success('Formulário salvo', `${categoria.name} atualizada.`)}
          onErro={(m) => toast.error('Não foi possível salvar', m)}
        />
      ))}
    </div>
  );
}

interface EditorProps {
  categoria: Category;
  /** As outras, para avisar quando uma cor já está em uso. */
  outras: Category[];
  aberta: boolean;
  onAlternar: () => void;
  onSalvo: () => void;
  onErro: (mensagem: string) => void;
}

function EditorDeCategoria({ categoria, outras, aberta, onAlternar, onSalvo, onErro }: EditorProps) {
  const [campos, setCampos] = useState<CampoDaCategoria[]>(() =>
    normalizarCampos(categoria.campos, categoria.slug),
  );

  const [cor, setCor] = useState(categoria.color ?? PALETA_DE_CATEGORIAS[0]);

  // Recarrega quando a categoria muda no servidor.
  useEffect(() => {
    setCampos(normalizarCampos(categoria.campos, categoria.slug));
    setCor(categoria.color ?? PALETA_DE_CATEGORIAS[0]);
  }, [categoria]);

  const salvar = useCrudMutation(
    (dados: { campos: CampoDaCategoria[]; color: string }) =>
      categoryService.update(categoria.id, dados),
    'categories',
  );

  const ativos = new Set(campos.map((c) => c.campo));

  const alternar = (chave: ChaveCampo) => {
    if (CAMPOS[chave].essencial) return;
    setCampos((atual) =>
      ativos.has(chave) ? atual.filter((c) => c.campo !== chave) : [...atual, { campo: chave }],
    );
  };

  const renomear = (chave: ChaveCampo, rotulo: string) =>
    setCampos((atual) =>
      atual.map((c) => (c.campo === chave ? { ...c, rotulo: rotulo || undefined } : c)),
    );

  const alternarObrigatorio = (chave: ChaveCampo) =>
    setCampos((atual) =>
      atual.map((c) => (c.campo === chave ? { ...c, obrigatorio: !c.obrigatorio } : c)),
    );

  const mover = (chave: ChaveCampo, direcao: -1 | 1) =>
    setCampos((atual) => {
      const i = atual.findIndex((c) => c.campo === chave);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= atual.length) return atual;
      const copia = [...atual];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const restaurar = () => setCampos(normalizarCampos(null, categoria.slug));

  async function confirmar() {
    try {
      await salvar.mutateAsync({ campos, color: cor });
      onSalvo();
    } catch (erro) {
      onErro(erro instanceof Error ? erro.message : 'Erro desconhecido');
    }
  }

  return (
    <Card>
      <button
        type="button"
        onClick={onAlternar}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-navy-800/60"
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: cor }}
        />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-navy-900 dark:text-slate-100">{categoria.name}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {campos.map((c) => rotuloDoCampo(c)).join(' · ')}
          </span>
        </span>
        <Badge tone="neutral">{campos.length} campos</Badge>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition', aberta && 'rotate-180')} />
      </button>

      {aberta && (
        <CardBody className="space-y-5 border-t border-slate-200 dark:border-navy-700">
          {/* A cor identifica a categoria na lista de estoque e nas abas. */}
          <div>
            <p className="label-base">Cor da categoria</p>
            <div className="flex flex-wrap gap-2">
              {PALETA_DE_CATEGORIAS.map((c) => {
                // Cor já usada por outra categoria: dá para escolher, mas
                // avisa — duas bolinhas iguais não separam nada.
                const deOutra = outras.find((x) => x.color?.toUpperCase() === c);

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    title={deOutra ? `Já usada por ${deOutra.name}` : c}
                    className={cn(
                      'relative h-8 w-8 rounded-full transition',
                      cor === c
                        ? 'ring-2 ring-navy-900 ring-offset-2 dark:ring-slate-200 dark:ring-offset-navy-900'
                        : 'hover:scale-110',
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  >
                    {deOutra && cor !== c && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 dark:border-navy-900" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              É a bolinha que aparece no estoque, nas abas e aqui. O ponto cinza marca as cores já
              usadas por outra categoria.
            </p>
          </div>

          {/* Campos escolhidos, na ordem em que aparecem no cadastro */}
          <div>
            <p className="label-base">Campos do formulário — na ordem em que aparecem</p>
            <div className="space-y-2">
              {campos.map((c, indice) => (
                <div
                  key={c.campo}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-navy-700 dark:bg-navy-800"
                >
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => mover(c.campo, -1)}
                      disabled={indice === 0}
                      className="px-1 text-[10px] text-slate-400 hover:text-navy-900 disabled:opacity-25 dark:hover:text-slate-200"
                      aria-label="Subir"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(c.campo, 1)}
                      disabled={indice === campos.length - 1}
                      className="px-1 text-[10px] text-slate-400 hover:text-navy-900 disabled:opacity-25 dark:hover:text-slate-200"
                      aria-label="Descer"
                    >
                      ▼
                    </button>
                  </div>

                  <GripVertical className="h-4 w-4 shrink-0 text-slate-300 dark:text-navy-600" />

                  <span className="w-32 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {CAMPOS[c.campo].rotulo}
                    {CAMPOS[c.campo].opcoes && (
                      <span className="block truncate font-normal text-slate-400">
                        {CAMPOS[c.campo].opcoes!.join(' / ')}
                      </span>
                    )}
                  </span>

                  <Input
                    value={c.rotulo ?? ''}
                    onChange={(e) => renomear(c.campo, e.target.value)}
                    placeholder={`Aparece como "${CAMPOS[c.campo].rotulo}"`}
                    wrapperClassName="min-w-[180px] flex-1"
                  />

                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={Boolean(c.obrigatorio) || Boolean(CAMPOS[c.campo].essencial)}
                      disabled={Boolean(CAMPOS[c.campo].essencial)}
                      onChange={() => alternarObrigatorio(c.campo)}
                      className="h-3.5 w-3.5 rounded border-slate-300 accent-accent disabled:opacity-50"
                    />
                    obrigatório
                  </label>

                  <button
                    type="button"
                    onClick={() => alternar(c.campo)}
                    disabled={Boolean(CAMPOS[c.campo].essencial)}
                    className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-danger transition hover:bg-danger-bg disabled:cursor-not-allowed disabled:text-slate-300 dark:hover:bg-danger/15 dark:disabled:text-navy-600"
                    title={
                      CAMPOS[c.campo].essencial
                        ? 'Campo essencial: não pode ser removido'
                        : 'Remover do formulário'
                    }
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Campos disponíveis para acrescentar */}
          {TODAS_AS_CHAVES.filter((k) => !ativos.has(k)).length > 0 && (
            <div>
              <p className="label-base">Acrescentar ao formulário</p>
              <div className="flex flex-wrap gap-2">
                {TODAS_AS_CHAVES.filter((k) => !ativos.has(k)).map((chave) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => alternar(chave)}
                    className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:bg-accent/5 hover:text-accent dark:border-navy-600 dark:text-slate-400"
                  >
                    + {CAMPOS[chave].rotulo}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-navy-700">
            <Button onClick={() => void confirmar()} loading={salvar.isPending} icon={<Save className="h-4 w-4" />}>
              Salvar formulário
            </Button>
            <Button variant="ghost" onClick={restaurar} icon={<RotateCcw className="h-4 w-4" />}>
              Voltar ao padrão
            </Button>
            <span className="text-xs text-slate-400">
              Nome, quantidade, custo e venda não podem sair — o sistema precisa deles.
            </span>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
