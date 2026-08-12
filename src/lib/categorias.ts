import type { Category } from '@/types';

/**
 * Opções de categoria para um select, já na ordem da árvore.
 *
 * A subcategoria vem recuada e sem repetir o nome da mãe: numa lista
 * "Celulares › Vitrine" ocupa espaço demais e o olho lê duas vezes a mesma
 * palavra. O valor continua sendo o id, então o servidor recebe a folha.
 */
export function opcoesDeCategoria(categorias: Category[] | undefined) {
  const lista = categorias ?? [];
  const mães = lista.filter((c) => !c.parentId);

  return mães.flatMap((mae) => [
    { value: mae.id, label: mae.name },
    ...lista
      .filter((c) => c.parentId === mae.id)
      .map((f) => ({ value: f.id, label: `    ${f.name.split('›').pop()!.trim()}` })),
  ]);
}

/** Nome curto: só a subcategoria quando houver, senão a categoria. */
export const nomeCurtoDaCategoria = (nome: string | null | undefined) =>
  (nome ?? '').split('›').pop()?.trim() ?? '';
