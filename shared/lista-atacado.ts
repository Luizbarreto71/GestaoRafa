/**
 * Regras de texto da lista que vai para o grupo de atacado.
 *
 * Ficam aqui, e não no servidor, porque a tela de configuração precisa
 * sugerir o mesmo emoji que o gerador usaria — se cada lado adivinhasse
 * por conta própria, o administrador veria uma coisa e o grupo receberia
 * outra.
 */

/** Emoji usado quando a categoria não se parece com nenhuma conhecida. */
export const EMOJI_PADRAO = '📦';

/**
 * Emoji sugerido a partir do nome da categoria.
 *
 * A ordem importa: "Celulares › Fones" tem as duas palavras, e o fone é o
 * que descreve a mercadoria.
 */
const POR_NOME: { procura: RegExp; emoji: string }[] = [
  { procura: /fone|headphone|airpod|earbud|buds/i, emoji: '🎧' },
  { procura: /watch|rel[oó]gio|smartwatch/i, emoji: '⌚' },
  { procura: /jbl|boombox|partybox|partbox|caixa de som|som\b/i, emoji: '🔉' },
  { procura: /note ?book|macbook|laptop/i, emoji: '💻' },
  { procura: /v[ií]deo ?game|playstation|xbox|nintendo|console/i, emoji: '🎮' },
  { procura: /\btvs?\b|televis/i, emoji: '📺' },
  { procura: /celular|iphone|smartphone|xiaomi|redmi|poco|realme|samsung|motorola|aparelho/i, emoji: '📱' },
];

/** O emoji que a categoria ganha quando ninguém escolheu um. */
export function emojiSugerido(nomeDaCategoria: string): string {
  const achou = POR_NOME.find((r) => r.procura.test(nomeDaCategoria));
  return achou?.emoji ?? EMOJI_PADRAO;
}

/** Linha decorativa do cabeçalho do dia. */
export const RISCO_TOPO = '——————————————————';

/** Linha decorativa que abre e fecha o título de cada categoria. */
export const RISCO_CATEGORIA = '——–——–——–——–';

/**
 * Cores escritas dentro do nome do produto.
 *
 * O cadastro guarda "IPHONE 17 256GB VERDE" — a cor faz parte do nome, não
 * de um campo. No atacado ela só polui: quem compra dez peças quer o
 * modelo e o preço, e escolhe a cor depois.
 */
const CORES = [
  'PRETO', 'PRETA', 'BRANCO', 'BRANCA', 'AZUL', 'VERDE', 'VERMELHO', 'VERMELHA',
  'ROXO', 'ROXA', 'ROSA', 'AMARELO', 'AMARELA', 'LARANJA', 'DOURADO', 'DOURADA',
  'PRATA', 'PRATEADO', 'CINZA', 'GRAFITE', 'TITANIO', 'BEGE', 'LILAS', 'CIANO',
  'MARROM', 'CORAL', 'MIDNIGHT', 'STARLIGHT', 'ESCURO', 'CLARO', 'FOSCO',
];

const semAcento = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/**
 * O nome como ele deve chegar no grupo.
 *
 * Tira a cor do fim, deixa a capacidade colada e em caixa alta ("256gb"
 * vira "256GB") e não mexe em mais nada: "VT", "CPO" e "4/128" são o que
 * distingue uma peça da outra, e sumir com eles trocaria a mercadoria.
 */
export function nomeParaLista(bruto: string): string {
  let nome = bruto.trim().replace(/\s+/g, ' ');

  // 256gb → 256GB · 1 tb → 1TB
  nome = nome.replace(/(\d+)\s*(gb|tb)\b/gi, (_, n: string, u: string) => `${n}${u.toUpperCase()}`);

  // Só do fim para trás: uma palavra de cor no meio do nome quase sempre é
  // o próprio produto ("CAPA ROSA"), e apagá-la deixaria a linha sem sentido.
  const partes = nome.split(' ');
  while (partes.length > 1 && CORES.includes(semAcento(partes[partes.length - 1]))) {
    partes.pop();
  }

  return partes.join(' ');
}

/**
 * A que família o produto pertence, para saber onde cai a linha em branco.
 *
 * "12 128GB VT" e "12 64GB VT" são o mesmo aparelho em duas capacidades e
 * ficam juntos; "12 PRO" é outro e ganha um respiro antes. É o que separa
 * uma lista que se lê de um paredão de linhas.
 */
export function familiaDoProduto(nome: string): string {
  const partes = nomeParaLista(nome)
    .split(' ')
    // 256GB, 1TB, 8/256 e 4/64 são capacidade, não modelo.
    .filter((t) => !/^\d+(GB|TB)$/i.test(t) && !/^\d+\s*\/\s*\d+$/.test(t));

  // "JBL PARTBOX 130" e "JBL PARTBOX 520" são a mesma linha de produto: o
  // número solto no fim é a variação. Com menos de três termos o número é
  // o próprio modelo ("PENCIL 2"), e aí fica.
  if (partes.length >= 3 && /^\d+$/.test(partes[partes.length - 1])) partes.pop();

  return semAcento(partes.join(' '));
}

/** R$ 5.080,00 — sempre com ponto no milhar e vírgula no centavo. */
export function precoDaLista(valor: number): string {
  const numero = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Montado à mão: a formatação de moeda do Node às vezes usa espaço
  // inquebrável entre o "R$" e o número, e ele viaja escondido no texto.
  return `R$ ${numero}`;
}

/** Saudação de acordo com a hora da loja. */
export function saudacao(hora: number): string {
  if (hora < 12) return 'BOM DIA';
  if (hora < 18) return 'BOA TARDE';
  return 'BOA NOITE';
}
