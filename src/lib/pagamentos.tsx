import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  QrCode,
  Repeat2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Cada forma de pagamento com o seu ícone e o que ela precisa perguntar.
 *
 * Fica num lugar só porque o balcão, a edição de venda e os avisos usam a
 * mesma lista — e uma forma que aparece com ícone diferente em cada tela
 * faz a pessoa duvidar se é a mesma coisa.
 */
export interface FormaDePagamentoInfo {
  valor: string;
  rotulo: string;
  /** Nome curto, para caber no botão. */
  curto: string;
  icone: LucideIcon;
  /** Classe da cor de destaque quando escolhida. */
  cor: string;
  /** Só o crédito parcela. Débito e Pix são sempre à vista. */
  parcela?: boolean;
  /** Não é dinheiro entrando agora. */
  naoEhDinheiro?: boolean;
}

export const FORMAS: FormaDePagamentoInfo[] = [
  { valor: 'PIX', rotulo: 'Pix', curto: 'Pix', icone: QrCode, cor: 'text-teal-500' },
  { valor: 'DINHEIRO', rotulo: 'Dinheiro', curto: 'Dinheiro', icone: Banknote, cor: 'text-success' },
  { valor: 'DEBITO', rotulo: 'Débito', curto: 'Débito', icone: CreditCard, cor: 'text-accent' },
  {
    valor: 'CREDITO',
    rotulo: 'Crédito',
    curto: 'Crédito',
    icone: CreditCard,
    cor: 'text-purple-500',
    parcela: true,
  },
  {
    valor: 'TRANSFERENCIA',
    rotulo: 'Transferência',
    curto: 'Transf.',
    icone: Landmark,
    cor: 'text-sky-500',
  },
  {
    valor: 'EM_ABERTO',
    rotulo: 'Valor em aberto',
    curto: 'Fiado',
    icone: HandCoins,
    cor: 'text-warning',
    naoEhDinheiro: true,
  },
  { valor: 'OUTRO', rotulo: 'Outro', curto: 'Outro', icone: Wallet, cor: 'text-slate-400' },
];

/** A troca entra sozinha, então não aparece para escolher. */
export const TROCA_INFO: FormaDePagamentoInfo = {
  valor: 'TROCA',
  rotulo: 'Troca (aparelho)',
  curto: 'Troca',
  icone: Repeat2,
  cor: 'text-purple-500',
  naoEhDinheiro: true,
};

export const infoDaForma = (valor: string) =>
  FORMAS.find((f) => f.valor === valor) ?? (valor === 'TROCA' ? TROCA_INFO : FORMAS[FORMAS.length - 1]);

/** Só o crédito pergunta parcelas. */
export const aceitaParcelas = (valor: string) => Boolean(infoDaForma(valor).parcela);
