export type ProductStatus = 'EM_ESTOQUE' | 'RESERVADO' | 'VENDIDO';
export type MovementType = 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE';

export type MovementReason =
  | 'COMPRA'
  | 'CADASTRO'
  | 'VENDA'
  | 'DEFEITO'
  | 'DEVOLUCAO_FORNECEDOR'
  | 'PERDA'
  | 'USO_INTERNO'
  | 'AJUSTE'
  | 'TRANSFERENCIA'
  | 'RETIRADA'
  | 'CANCELAMENTO'
  | 'EXCLUSAO'
  | 'OUTRO';

export type TransferStatus = 'PENDENTE' | 'EM_TRANSITO' | 'RECEBIDA' | 'CANCELADA';

export type WithdrawalStatus = 'PENDENTE' | 'APROVADA' | 'CANCELADA';

/** Retirada do estoque para a loja, aprovada no fim do dia. */
export interface Withdrawal {
  id: string;
  quantity: number;
  soldQuantity?: number | null;
  returnedQuantity?: number | null;
  status: WithdrawalStatus;
  notes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  product: { id: string; name: string; model?: string | null };
  unit: { id: string; name: string };
}

/** Matriz, Sede… Cada uma com seu estoque. */
export interface Unit {
  id: string;
  name: string;
  type: 'MATRIZ' | 'FILIAL';
  active: boolean;
  _count?: { stock: number; sales: number };
}

/** Saldo de um produto numa unidade. */
export interface StockLine {
  unitId: string;
  unitName: string;
  quantity: number;
  /** Comprometido com retiradas pendentes. */
  reserved?: number;
  /** Livre para vender (quantity - reserved). */
  available?: number;
}
export type PaymentMethod =
  | 'PIX'
  | 'DINHEIRO'
  | 'DEBITO'
  | 'CREDITO'
  | 'TRANSFERENCIA'
  | 'TROCA'
  | 'OUTRO';
export type UserRole = 'ADMIN' | 'GERENTE' | 'CAIXA' | 'VENDEDOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active?: boolean;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  /** Campos do formulário desta categoria (ver shared/campos.ts). */
  campos?: unknown;
  icon?: string | null;
  color?: string | null;
  _count?: { products: number };
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt?: string;
  _count?: { products: number };
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  notes?: string | null;
  createdAt?: string;
  _count?: { sales: number };
  sales?: Sale[];
}

export interface Product {
  id: string;
  name: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  capacity?: string | null;
  lote?: string | null;
  /** Lacrado, Vitrine, Seminovo… */
  condicao?: string | null;
  quantity: number;
  minQuantity: number;
  /** Custo médio ponderado — recalculado a cada entrada de mercadoria. */
  costPrice: number;
  /** Quanto foi pago na compra mais recente. */
  lastPurchaseCost?: number | null;
  lastPurchaseAt?: string | null;
  salePrice: number;
  /** Preço de atacado; vazio quando o produto só é vendido no varejo. */
  wholesalePrice?: number | null;
  imei?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  notes?: string | null;
  status: ProductStatus;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
  categoryId: string;
  category: Category;
  supplierId?: string | null;
  supplier?: Supplier | null;
  /** URLs das fotos, ex.: `/api/fotos/<id>`. A primeira é a principal. */
  photos: string[];
  /** Saldo em cada unidade. */
  stock: StockLine[];
  /** Soma das unidades. */
  totalQuantity?: number;
  /** Em transferências ainda não recebidas. */
  inTransit?: number;
  totalAvailable?: number;
  totalPhysical?: number;
  movements?: Movement[];
  sales?: Sale[];
}

export type PreSaleStatus =
  | 'AGUARDANDO_CAIXA'
  | 'EM_ATENDIMENTO'
  | 'FINALIZADA'
  | 'CANCELADA'
  | 'EXPIRADA';

/** Item dentro de uma venda ou pré-venda. */
export interface ItemVenda {
  id?: string;
  productId: string;
  productName?: string | null;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  imei?: string | null;
  serialNumber?: string | null;
  product?: {
    id: string;
    name: string;
    model?: string | null;
    brand?: string | null;
    capacity?: string | null;
    color?: string | null;
    condicao?: string | null;
    photos?: { id: string }[];
  };
  /** Saldo atual na unidade, calculado pela API ao abrir a pré-venda. */
  disponivel?: number | null;
  /** Só para a tela conferir de relance; a API não recebe nem devolve. */
  foto?: string | null;
  detalhes?: string;
}

/** Intenção de venda montada pelo vendedor. Não mexe no estoque. */
export interface PreSale {
  id: string;
  code: string;
  status: PreSaleStatus;
  totalAmount: number;
  paymentMethod?: PaymentMethod | null;
  installments: number;
  notes?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerDocument?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  items: ItemVenda[];
  seller?: { id: string; name: string } | null;
  cashier?: { id: string; name: string } | null;
  unit?: { id: string; name: string } | null;
  sale?: { id: string; code: string } | null;
  /** Aparelho usado dado como parte do pagamento. */
  tradeIn?: Pick<
    Troca,
    'id' | 'code' | 'modelo' | 'imei' | 'imeiSituacao' | 'valorAvaliado' | 'estado' | 'defeitos'
  > | null;
}

export type SituacaoImei = 'NAO_CONSULTADO' | 'REGULAR' | 'IRREGULAR' | 'BLOQUEADO';
export type TrocaStatus = 'AVALIADA' | 'ACEITA' | 'RECUSADA';

export interface TrocaFoto {
  id: string;
  tipo: 'ANATEL' | 'DOCUMENTO' | 'APARELHO';
  url: string;
}

/** Aparelho usado recebido como parte do pagamento. */
export interface Troca {
  id: string;
  code: string;
  status: TrocaStatus;

  modelo: string;
  marca?: string | null;
  armazenamento?: string | null;
  cor?: string | null;
  imei: string;
  imeiSituacao: SituacaoImei;
  imeiCheckedAt?: string | null;

  estado?: string | null;
  defeitos: string[];
  observacoes?: string | null;

  valorAvaliado: number;
  saidaNome?: string | null;
  valorSaida: number;
  /** Quanto o cliente ainda paga. Negativo = a loja é que deve. */
  diferenca: number;

  customerName: string;
  customerPhone?: string | null;
  customerDocument?: string | null;

  createdAt: string;
  photos: TrocaFoto[];
  seller?: { id: string; name: string } | null;
  unit?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  preSale?: { id: string; code: string; status: PreSaleStatus } | null;
  sale?: { id: string; code: string } | null;
  tradeIn?: Pick<
    Troca,
    'id' | 'code' | 'modelo' | 'imei' | 'imeiSituacao' | 'valorAvaliado' | 'estado' | 'defeitos'
  > | null;
}

export interface Notificacao {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface TurnoDeCaixa {
  id: string;
  code: string;
  status: 'ABERTO' | 'FECHADO';
  openedAt: string;
  closedAt?: string | null;
  notes?: string | null;
  cashier?: { name: string };
  unit?: { name: string } | null;
}

export interface ResumoDoCaixa {
  quantidadeDeVendas: number;
  itensVendidos: number;
  total: number;
  lucro: number;
  ticketMedio: number;
  /** Diferença entre o total do turno e a soma das formas. Zero = tudo certo. */
  divergencia: number;
  porPagamento: { forma: PaymentMethod; rotulo: string; quantidade: number; total: number }[];
}

export interface Sale {
  id: string;
  code: string;
  status: 'FINALIZADA' | 'CANCELADA';
  totalAmount: number;
  costAmount: number;
  paymentMethod: PaymentMethod;
  installments: number;
  saleDate: string;
  notes?: string | null;
  items: ItemVenda[];
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerDocument?: string | null;
  unit: { id: string; name: string };
  seller?: { id: string; name: string } | null;
  cashier?: { id: string; name: string } | null;
  preSale?: { id: string; code: string } | null;
  /** Nome digitado no balcão, quando o vendedor não tem login. */
  sellerName?: string | null;
  /** Rateio quando o cliente pagou de mais de um jeito. */
  payments?: {
    id: string;
    method: PaymentMethod;
    amount: number;
    installments: number;
    notes?: string | null;
  }[];
}

export interface Movement {
  id: string;
  type: MovementType;
  reason: MovementReason;
  quantity: number;
  previousQuantity?: number | null;
  newQuantity?: number | null;
  notes?: string | null;
  createdAt: string;
  productId?: string | null;
  productName?: string | null;
  product?: { id: string; name: string; model?: string | null; category?: { name: string } } | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  originUnitName?: string | null;
  destinationUnitName?: string | null;
  transferId?: string | null;
  user?: { id: string; name: string } | null;
}

export interface Transfer {
  id: string;
  quantity: number;
  status: TransferStatus;
  notes?: string | null;
  createdAt: string;
  receivedAt?: string | null;
  product: { id: string; name: string; model?: string | null };
  originUnit: { id: string; name: string };
  destinationUnit: { id: string; name: string };
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: unknown;
  ip?: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface SalesPage extends Paginated<Sale> {
  totals: { revenue: number; profit: number; items: number };
}

export interface PreSalesPage extends Paginated<PreSale> {
  pendentes: number;
}

export interface MovementsPage extends Paginated<Movement> {
  summary: Record<string, { count: number; quantity: number }>;
}

export interface DashboardData {
  cards: {
    totalProducts: number;
    itemsInStock: number;
    soldToday: number;
    salesCountToday: number;
    revenueToday: number;
    profitToday: number;
    stockValueCost: number;
    stockValueSale: number;
    lowStockCount: number;
    outOfStockCount: number;
    entradas: number;
    saidas: number;
    revenueMonth: number;
    profitMonth: number;
    itemsSoldMonth: number;
  };
  chart: { date: string; vendas: number; faturamento: number; entradas: number; saidas: number }[];
  categories: { categoryId: string; name: string; color: string; products: number; quantity: number }[];
  lowStockProducts: Product[];
  latestSales: Sale[];
}

export interface AlertsData {
  lowStock: {
    id: string;
    name: string;
    quantity: number;
    minQuantity: number;
    model?: string | null;
    unitName?: string | null;
  }[];
  outOfStock: { id: string; name: string; model?: string | null; unitName?: string | null }[];
  soldToday: {
    id: string;
    customerName?: string | null;
    totalPrice: number;
    quantity: number;
    saleDate: string;
    product: { name: string };
  }[];
  soldTodayCount: number;
  revenueToday: number;
  stockValue: number;
  updatedAt: string;
}

export interface QuickSearchResult {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
}
