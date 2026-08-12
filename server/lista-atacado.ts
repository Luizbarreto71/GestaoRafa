import { FUSO_DA_LOJA } from './core';
import {
  emojiSugerido,
  familiaDoProduto,
  nomeParaLista,
  precoDaLista,
  RISCO_CATEGORIA,
  RISCO_TOPO,
  saudacao,
} from '../shared/lista-atacado';
import { compararProdutos } from '../shared/ordenar';

/** O que o gerador precisa saber de cada produto. */
export type ProdutoDaLista = {
  name: string;
  capacity?: string | null;
  atacado: number;
  categoriaId: string;
  categoriaNome: string;
  /** Posição da categoria escolhida pelo administrador. */
  categoriaOrdem: number;
};

/** Uma linha pronta, já sem cor e com o preço formatado. */
type Linha = { nome: string; preco: number; familia: string };

/** Data e hora na loja, e não no servidor — que roda em UTC. */
function agoraNaLoja(momento: Date): { data: string; hora: number } {
  const data = momento.toLocaleDateString('pt-BR', {
    timeZone: FUSO_DA_LOJA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const hora = Number(
    momento.toLocaleString('pt-BR', { timeZone: FUSO_DA_LOJA, hour: '2-digit', hour12: false }),
  );

  return { data, hora: Number.isFinite(hora) ? hora : 12 };
}

/**
 * Monta a mensagem do grupo de atacado.
 *
 * O texto é o produto final: vai ser colado no WhatsApp exatamente como
 * sai daqui, então cada quebra de linha e cada ponto e vírgula fazem parte
 * do resultado. Nada de HTML, nada de negrito — o que o grupo vê é isto.
 */
export function montarListaDeAtacado(
  produtos: ProdutoDaLista[],
  emojis: Record<string, string>,
  momento = new Date(),
): { texto: string; resumo: { linhas: number; categorias: number; juntados: number } } {
  const { data, hora } = agoraNaLoja(momento);

  const partes: string[] = [RISCO_TOPO, `📅 ${saudacao(hora)} - ${data} 📅`, RISCO_TOPO, ''];

  // Uma categoria por bloco, na ordem que o administrador definiu.
  const categorias = new Map<string, { nome: string; ordem: number; itens: ProdutoDaLista[] }>();

  for (const p of produtos) {
    const bloco = categorias.get(p.categoriaId);
    if (bloco) bloco.itens.push(p);
    else categorias.set(p.categoriaId, { nome: p.categoriaNome, ordem: p.categoriaOrdem, itens: [p] });
  }

  const ordenadas = [...categorias.entries()].sort(
    ([, a], [, b]) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  let totalDeLinhas = 0;
  let juntados = 0;

  for (const [categoriaId, bloco] of ordenadas) {
    const emoji = emojis[categoriaId]?.trim() || emojiSugerido(bloco.nome);

    // Do jeito que foi cadastrado: quem escreve "JBLs e BOOMBOX" quis
    // aquele "s" minúsculo, e forçar caixa alta desfaz a escolha.
    partes.push(RISCO_CATEGORIA, `${emoji} ${bloco.nome}`, RISCO_CATEGORIA, '');

    const linhas: Linha[] = [];

    for (const p of [...bloco.itens].sort(compararProdutos)) {
      const nome = nomeParaLista(p.name);

      // Duas cores do mesmo aparelho pelo mesmo preço são uma oferta só.
      // Preços diferentes continuam em linhas diferentes: aí não é a cor
      // que muda, é o negócio.
      const repetida = linhas.some((l) => l.nome === nome && l.preco === p.atacado);
      if (repetida) {
        juntados += 1;
        continue;
      }

      linhas.push({ nome, preco: p.atacado, familia: familiaDoProduto(p.name) });
    }

    linhas.forEach((linha, i) => {
      // Respiro entre famílias: "12" e "12 PRO" são aparelhos diferentes e
      // o olho precisa do corte para achar o modelo na hora de responder.
      if (i > 0 && linha.familia !== linhas[i - 1].familia) partes.push('');
      partes.push(`${emoji} - ${linha.nome} - ${precoDaLista(linha.preco)};`);
    });

    partes.push('');
    totalDeLinhas += linhas.length;
  }

  // Sem linha em branco sobrando no fim: no WhatsApp ela vira um balão com
  // um vazio embaixo do texto.
  while (partes.length && partes[partes.length - 1] === '') partes.pop();

  return {
    texto: partes.join('\n'),
    resumo: { linhas: totalDeLinhas, categorias: ordenadas.length, juntados },
  };
}
