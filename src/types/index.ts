export type ProductStatus = 'EM_ESTOQUE' | 'RESERVADO' | 'VENDIDO';
export type MovementType = 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'EXCLUSAO';
export type PaymentMethod = 'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA';
export type UserRole = 'ADMIN' | 'OPERADOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active?: boolean;
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
  quantity: number;
  minQuantity: number;
  costPrice: number;
  salePrice: number;
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
  movements?: Movement[];
  sales?: Sale[];
}

export interface Sale {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costAtSale: number;
  paymentMethod: PaymentMethod;
  saleDate: string;
  notes?: string | null;
  productId: string;
  product: Pick<Product, 'id' | 'name' | 'model' | 'category'> & Partial<Product>;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  user?: { id: string; name: string } | null;
}

export interface Movement {
  id: string;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  balanceAfter?: number | null;
  createdAt: string;
  productId?: string | null;
  productName?: string | null;
  product?: { id: string; name: string; model?: string | null; category?: { name: string } } | null;
  user?: { id: string; name: string } | null;
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
  totals: { revenue: number; items: number };
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
  lowStock: { id: string; name: string; quantity: number; minQuantity: number; model?: string | null }[];
  outOfStock: { id: string; name: string; model?: string | null }[];
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
