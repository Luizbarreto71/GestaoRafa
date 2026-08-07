import { api } from '@/lib/api';
import type {
  AlertsData,
  AuditLog,
  Category,
  Customer,
  DashboardData,
  MovementsPage,
  Paginated,
  Product,
  QuickSearchResult,
  Sale,
  SalesPage,
  Supplier,
  User,
} from '@/types';

/**
 * Camada de acesso à API. Os hooks do React Query consomem estas funções;
 * nenhum componente chama `api` diretamente.
 */

/** Remove chaves vazias para não enviar filtros em branco na query string. */
const clean = (params: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  );

// ------------------------------------------------------------------ Produtos

export interface ProductFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  supplierId?: string;
  status?: string;
  brand?: string;
  model?: string;
  lowStock?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const productService = {
  list: (filters: ProductFilters) =>
    api.get<Paginated<Product>>('/products', { params: clean(filters) }).then((r) => r.data),
  get: (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Product>('/products', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Product>(`/products/${id}`, data).then((r) => r.data),
  adjustStock: (id: string, data: { quantity: number; reason: string }) =>
    api.patch<Product>(`/products/${id}/stock`, data).then((r) => r.data),
  remove: (id: string, reason?: string) =>
    api.delete<{ message: string; archived: boolean }>(`/products/${id}`, { params: clean({ reason }) }).then((r) => r.data),
  filters: () => api.get<{ brands: string[]; models: string[] }>('/products/filters').then((r) => r.data),
  quickSearch: (q: string) =>
    api.get<QuickSearchResult>('/products/search', { params: { q } }).then((r) => r.data),
};

// -------------------------------------------------------------------- Vendas

export interface SaleFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  productId?: string;
  categoryId?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const saleService = {
  list: (filters: SaleFilters) => api.get<SalesPage>('/sales', { params: clean(filters) }).then((r) => r.data),
  get: (id: string) => api.get<Sale>(`/sales/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Sale>('/sales', data).then((r) => r.data),
  remove: (id: string) => api.delete<{ message: string }>(`/sales/${id}`).then((r) => r.data),
};

// ------------------------------------------------------------- Movimentações

export interface MovementFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  productId?: string;
  userId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: 'asc' | 'desc';
}

export const movementService = {
  list: (filters: MovementFilters) =>
    api.get<MovementsPage>('/movements', { params: clean(filters) }).then((r) => r.data),
};

// ----------------------------------------------------------------- Dashboard

export const dashboardService = {
  overview: (days = 14) => api.get<DashboardData>('/dashboard', { params: { days } }).then((r) => r.data),
  alerts: () => api.get<AlertsData>('/dashboard/alerts').then((r) => r.data),
};

// ----------------------------------------------------------------- Cadastros

export const categoryService = {
  list: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Category>('/categories', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Category>(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/categories/${id}`).then((r) => r.data),
};

export const supplierService = {
  list: (params: { page?: number; pageSize?: number; search?: string; all?: string } = {}) =>
    api.get<Paginated<Supplier>>('/suppliers', { params: clean(params) }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Supplier>('/suppliers', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Supplier>(`/suppliers/${id}`, data).then((r) => r.data),
  remove: (id: string) =>
    api.delete<{ message: string; deactivated: boolean }>(`/suppliers/${id}`).then((r) => r.data),
};

export const customerService = {
  list: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    api.get<Paginated<Customer>>('/customers', { params: clean(params) }).then((r) => r.data),
  get: (id: string) => api.get<Customer>(`/customers/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<Customer>('/customers', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<Customer>(`/customers/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/customers/${id}`).then((r) => r.data),
};

export const userService = {
  list: (params: { page?: number; pageSize?: number; search?: string } = {}) =>
    api.get<Paginated<User>>('/users', { params: clean(params) }).then((r) => r.data),
  create: (data: Record<string, unknown>) => api.post<User>('/users', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) => api.put<User>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
  logs: (params: { page?: number; pageSize?: number; userId?: string } = {}) =>
    api.get<Paginated<AuditLog>>('/users/logs/activity', { params: clean(params) }).then((r) => r.data),
};

// ---------------------------------------------------------------- Importação

export const importService = {
  products: async (file: File, dryRun = false) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<{
      dryRun: boolean;
      processed: number;
      imported: number;
      errors: { row: number; message: string }[];
      message: string;
    }>('/settings/import/products', form, {
      params: { dryRun: String(dryRun) },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

// -------------------------------------------------------------- Configurações

export const settingsService = {
  sheetsStatus: () =>
    api
      .get<{ enabled: boolean; configured: boolean; spreadsheetId: string | null; sheetName: string }>(
        '/settings/sheets/status',
      )
      .then((r) => r.data),
  syncSheets: () => api.post<{ message: string; synced: number }>('/settings/sheets/sync').then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    api.post<{ message: string }>('/auth/change-password', data).then((r) => r.data),
};
