/**
 * Ordenação de produtos do menor para o maior.
 *
 * Ordem alfabética mente com nome de aparelho: "12 128GB" viria antes de
 * "12 64GB", "iPhone 10" antes de "iPhone 9", e "1TB" antes de "512GB".
 * Aqui cada sequência de dígitos vale como número.
 */

/** Reconhece "256GB", "1 TB", "12/512" e "4/128". */
const CAPACIDADE = /(\d+)\s*(GB|TB)\b|\b\d+\s*\/\s*(\d+)\b/i;

/**
 * Capacidade em GB, para comparar maçã com maçã.
 *
 * "1TB" vira 1024 — senão o 1 do terabyte ficaria antes do 64 do menor
 * aparelho da prateleira. Em "12/512" o primeiro número é RAM e o segundo
 * é o armazenamento.
 */
export function capacidadeEmGB(nome: string, campo?: string | null): number {
  const alvo = campo?.trim() || nome;
  const achou = alvo.match(CAPACIDADE);
  if (!achou) return 0;
  if (achou[3]) return Number(achou[3]);

  const valor = Number(achou[1]);
  return achou[2]?.toUpperCase() === 'TB' ? valor * 1024 : valor;
}

/**
 * Põe o terabyte na mesma escala do gigabyte dentro do texto.
 *
 * Feito antes de comparar, e não depois: assim a comparação natural resolve
 * modelo e capacidade de uma vez, na ordem em que aparecem no nome.
 */
const emGigas = (nome: string) =>
  nome.replace(/(\d+)\s*TB\b/gi, (_, n) => `${Number(n) * 1024}GB`);

/**
 * Compara texto tratando cada sequência de dígitos como número.
 *
 * "iPhone 9" antes de "iPhone 10", que a ordem alfabética inverteria.
 */
export function compararNatural(a: string, b: string): number {
  // Sem acento e em caixa alta, para "Ário" e "ARIO" ficarem juntos.
  const limpar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

  const pa = limpar(a).match(/\d+|\D+/g) ?? [];
  const pb = limpar(b).match(/\d+|\D+/g) ?? [];

  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i];
    const y = pb[i];
    // Quem acabou primeiro é o menor: "15" antes de "15 PRO".
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    if (/^\d/.test(x) && /^\d/.test(y)) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else {
      // Comparação direta, e não localeCompare: a regra de idioma ignora o
      // espaço, e aí "15 PRO MAX" vinha antes de "15".
      if (x < y) return -1;
      if (x > y) return 1;
    }
  }
  return 0;
}

/**
 * Ordem de prateleira: modelo crescente e, dentro dele, capacidade
 * crescente.
 */
export function compararProdutos(
  a: { name: string; capacity?: string | null },
  b: { name: string; capacity?: string | null },
): number {
  const porNome = compararNatural(emGigas(a.name), emGigas(b.name));
  if (porNome !== 0) return porNome;

  // Nomes iguais: desempata pelo campo de capacidade, quando preenchido.
  return capacidadeEmGB(a.name, a.capacity) - capacidadeEmGB(b.name, b.capacity);
}
