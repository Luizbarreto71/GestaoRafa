import { getErrorMessage } from '@/lib/api';
import type { Sale, Troca } from '@/types';
import { enqueue, isOfflineError } from '@/lib/offline';
import {
  caixaService,
  categoryService,
  customerService,
  dashboardService,
  movementService,
  notificacaoService,
  preVendaService,
  productService,
  saleService,
  settingsService,
  supplierService,
  trocaService,
  type MovementFilters,
  type ProductFilters,
  type SaleFilters,
  unitService,
  userService,
} from '@/services';
import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';

export const queryKeys = {
  dashboard: (days: number) => ['dashboard', days] as const,
  alerts: () => ['dashboard', 'alerts'] as const,
  products: (filters: ProductFilters) => ['products', filters] as const,
  product: (id: string) => ['products', id] as const,
  productFilters: () => ['products', 'filters'] as const,
  sales: (filters: SaleFilters) => ['sales', filters] as const,
  movements: (filters: MovementFilters) => ['movements', filters] as const,
  categories: () => ['categories'] as const,
  suppliers: (params: object) => ['suppliers', params] as const,
  customers: (params: object) => ['customers', params] as const,
  users: (params: object) => ['users', params] as const,
  logs: (params: object) => ['logs', params] as const,
  sheetsStatus: () => ['settings', 'sheets'] as const,
};

/** Invalida tudo que depende do estoque após uma gravação. */
function invalidateStock(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['sales'] });
  void queryClient.invalidateQueries({ queryKey: ['movements'] });
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}

// ----------------------------------------------------------------- Dashboard

export const useDashboard = (days = 14, unitId?: string | null, date?: string) =>
  useQuery({
    queryKey: [...queryKeys.dashboard(days), unitId ?? 'todas', date ?? 'hoje'],
    queryFn: () => dashboardService.overview(days, unitId ?? undefined, date),
    staleTime: 30_000,
  });

export const useAlerts = (enabled = true, unitId?: string | null) =>
  useQuery({
    queryKey: [...queryKeys.alerts(), unitId ?? 'todas'],
    queryFn: () => dashboardService.alerts(unitId ?? undefined),
    // Valor do estoque "em tempo real": recarrega a cada minuto.
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled,
  });

// ------------------------------------------------------------------ Produtos

export const useProducts = (filters: ProductFilters) =>
  useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: () => productService.list(filters),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

export const useProduct = (id?: string) =>
  useQuery({
    queryKey: queryKeys.product(id ?? ''),
    queryFn: () => productService.get(id!),
    enabled: Boolean(id),
  });

export const useProductFilters = () =>
  useQuery({
    queryKey: queryKeys.productFilters(),
    queryFn: productService.filters,
    staleTime: 5 * 60_000,
  });

export const useQuickSearch = (term: string) =>
  useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => productService.quickSearch(term),
    enabled: term.trim().length >= 2,
    staleTime: 10_000,
  });

interface OfflineOptions {
  /** Mensagem exibida quando a operação vai para a fila offline. */
  offlineLabel?: string;
}

export function useCreateProduct(options?: OfflineOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      try {
        return await productService.create(data);
      } catch (error) {
        if (isOfflineError(error)) {
          enqueue({
            method: 'post',
            url: '/products',
            data,
            label: options?.offlineLabel ?? `Cadastro: ${data.name}`,
          });
          throw new Error('OFFLINE_QUEUED');
        }
        throw new Error(getErrorMessage(error));
      }
    },
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      productService.update(id, data).catch((error) => {
        if (isOfflineError(error)) {
          enqueue({ method: 'put', url: `/products/${id}`, data, label: `Edição: ${data.name ?? id}` });
          throw new Error('OFFLINE_QUEUED');
        }
        throw new Error(getErrorMessage(error));
      }),
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      productService.remove(id, reason).catch((error) => {
        throw new Error(getErrorMessage(error));
      }),
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      quantity,
      reason,
      unitId,
    }: {
      id: string;
      quantity: number;
      reason: string;
      unitId?: string;
    }) =>
      productService.adjustStock(id, { quantity, reason, unitId }).catch((error) => {
        throw new Error(getErrorMessage(error));
      }),
    onSuccess: () => invalidateStock(queryClient),
  });
}

// -------------------------------------------------------------------- Vendas

export const useSales = (filters: SaleFilters) =>
  useQuery({
    queryKey: queryKeys.sales(filters),
    queryFn: () => saleService.list(filters),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

export function useCreateSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      try {
        return await saleService.create(data);
      } catch (error) {
        if (isOfflineError(error)) {
          enqueue({
            method: 'post',
            url: '/sales',
            data,
            label: `Venda: ${data.customerName || 'Consumidor'}`,
          });
          throw new Error('OFFLINE_QUEUED');
        }
        throw new Error(getErrorMessage(error));
      }
    },
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      saleService.remove(id).catch((error) => {
        throw new Error(getErrorMessage(error));
      }),
    onSuccess: () => invalidateStock(queryClient),
  });
}

// ------------------------------------------------------------- Movimentações

export const useMovements = (filters: MovementFilters) =>
  useQuery({
    queryKey: queryKeys.movements(filters),
    queryFn: () => movementService.list(filters),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

// ----------------------------------------------------------------- Cadastros

export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.categories(),
    queryFn: categoryService.list,
    staleTime: 5 * 60_000,
  });

export const useSuppliers = (params: { page?: number; pageSize?: number; search?: string; all?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.suppliers(params),
    queryFn: () => supplierService.list(params),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

export const useCustomers = (params: { page?: number; pageSize?: number; search?: string } = {}) =>
  useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => customerService.list(params),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });

export const useUsers = (params: { page?: number; pageSize?: number; search?: string } = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => userService.list(params),
    enabled,
    staleTime: 60_000,
  });

export const useActivityLogs = (params: { page?: number; pageSize?: number } = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.logs(params),
    queryFn: () => userService.logs(params),
    enabled,
    staleTime: 30_000,
  });

export const useSheetsStatus = () =>
  useQuery({
    queryKey: queryKeys.sheetsStatus(),
    queryFn: settingsService.sheetsStatus,
    staleTime: 5 * 60_000,
  });

// ------------------------------------------------------------- Pré-vendas

export const usePreVendas = (params: { status?: string; search?: string; page?: number } = {}) =>
  useQuery({
    queryKey: ['pre-sales', params],
    queryFn: () => preVendaService.listar(params),
    placeholderData: (previous) => previous,
    // A fila do caixa precisa aparecer sozinha: recarrega de meio em meio minuto.
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

export const usePreVenda = (id?: string) =>
  useQuery({
    queryKey: ['pre-sales', id],
    queryFn: () => preVendaService.buscar(id!),
    enabled: Boolean(id),
  });

/** Tudo que mexe em pré-venda invalida a fila, o estoque e as vendas. */
function useAcaoDePreVenda<T>(acao: (v: T) => Promise<{ message: string } | unknown>) {
  const queryClient = useQueryClient();

  // `sale` só vem na finalização — é o que a tela usa para o comprovante.
  return useMutation<{ message: string; sale?: Sale }, Error, T>({
    mutationFn: (v) =>
      acao(v).catch((erro) => {
        throw new Error(getErrorMessage(erro));
      }) as Promise<{ message: string; sale?: Sale }>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pre-sales'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      invalidateStock(queryClient);
    },
  });
}

export const useCriarPreVenda = () =>
  useAcaoDePreVenda((dados: Record<string, unknown>) => preVendaService.criar(dados)) as ReturnType<
    typeof useMutation<{ message: string }, Error, Record<string, unknown>>
  >;

export const useAtenderPreVenda = () => useAcaoDePreVenda((id: string) => preVendaService.atender(id));

export const useFinalizarPreVenda = () =>
  useAcaoDePreVenda((v: { id: string; dados: Record<string, unknown> }) =>
    preVendaService.finalizar(v.id, v.dados),
  );

export const useCancelarPreVenda = () =>
  useAcaoDePreVenda((v: { id: string; motivo?: string }) => preVendaService.cancelar(v.id, v.motivo));

export const useDesistirPreVenda = () => useAcaoDePreVenda((id: string) => preVendaService.desistir(id));

// ------------------------------------------------------------------ Caixa

export const useCaixaAtual = (habilitado = true) =>
  useQuery({
    queryKey: ['cash', 'atual'],
    queryFn: caixaService.atual,
    enabled: habilitado,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

export const useTurnosDeCaixa = (params: { status?: string } = {}, habilitado = true) =>
  useQuery({
    queryKey: ['cash', params],
    queryFn: () => caixaService.turnos(params),
    enabled: habilitado,
    staleTime: 30_000,
  });

export function useAcaoDeCaixa<T>(acao: (v: T) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, T>({
    mutationFn: (v) =>
      acao(v).catch((erro) => {
        throw new Error(getErrorMessage(erro));
      }) as Promise<{ message: string }>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cash'] });
      invalidateStock(queryClient);
    },
  });
}

// ------------------------------------------------------------ Notificações

export const useNotificacoes = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificacaoService.listar(),
    // O caixa precisa saber da pré-venda nova sem recarregar a página.
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

export function useMarcarLida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id?: string) => notificacaoService.marcarLida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ------------------------------------------------- Movimentação de estoque

export const useUnits = () =>
  useQuery({ queryKey: ['units'], queryFn: unitService.list, staleTime: 5 * 60_000 });

export const useTransfers = (params: { page?: number; status?: string; unitId?: string } = {}) =>
  useQuery({
    queryKey: ['transfers', params],
    queryFn: () => movementService.transferencias(params),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });

export const useWithdrawals = (params: { status?: string; unitId?: string } = {}) =>
  useQuery({
    queryKey: ['withdrawals', params],
    queryFn: () => movementService.retiradas(params),
    placeholderData: (previous) => previous,
    staleTime: 10_000,
  });

/** Criar, aprovar e cancelar retirada — tudo invalida estoque e reservas. */
export function useRetirada(acao: 'criar' | 'aprovar' | 'cancelar') {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { id?: string; soldQuantity?: number } & Record<string, unknown>>({
    mutationFn: (v) => {
      const chamada =
        acao === 'criar'
          ? movementService.retirar(v)
          : acao === 'aprovar'
            ? movementService.aprovarRetirada(v.id!, v.soldQuantity ?? 0)
            : movementService.cancelarRetirada(v.id!);

      return chamada.catch((erro) => {
        throw new Error(getErrorMessage(erro));
      });
    },
    onSuccess: () => {
      invalidateStock(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
    },
  });
}

/** Entrada, saída, transferência e ajuste — todas mexem no estoque. */
export function useMovimentarEstoque(acao: 'entrada' | 'saida' | 'transferir' | 'ajustar') {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; antes?: number; depois?: number }, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      movementService[acao](data).catch((erro) => {
        throw new Error(getErrorMessage(erro));
      }),
    onSuccess: () => {
      invalidateStock(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}

export function useCancelarTransferencia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      movementService.cancelarTransferencia(id).catch((erro) => {
        throw new Error(getErrorMessage(erro));
      }),
    onSuccess: () => {
      invalidateStock(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}

/**
 * Fábrica de mutações CRUD para os cadastros simples — evita repetir o mesmo
 * bloco para fornecedores, clientes, usuários e categorias.
 */
export function useCrudMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKey: string,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) =>
      mutationFn(variables).catch((error) => {
        throw new Error(getErrorMessage(error));
      }),
    ...options,
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: [invalidateKey] });
      options?.onSuccess?.(...args);
    },
  });
}


// ------------------------------------------------------------------ Trocas

export const useTrocas = (params: { status?: string; search?: string; livres?: string } = {}) =>
  useQuery({ queryKey: ['trocas', params], queryFn: () => trocaService.listar(params) });

/**
 * Criar, consultar a Anatel, recusar e excluir.
 *
 * Tudo invalida as trocas e as pré-vendas: uma troca livre é opção de
 * abatimento na hora de montar o pedido.
 */
export function useTroca(acao: 'criar' | 'anatel' | 'recusar' | 'excluir') {
  const qc = useQueryClient();

  return useMutation<{ message?: string } & Partial<Troca>, Error, { id?: string; dados?: Record<string, unknown> }>({
    mutationFn: (v) =>
      acao === 'criar'
        ? trocaService.criar(v.dados ?? {})
        : acao === 'anatel'
          ? trocaService.anatel(v.id!, v.dados as never)
          : acao === 'recusar'
            ? trocaService.recusar(v.id!)
            : trocaService.excluir(v.id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trocas'] });
      void qc.invalidateQueries({ queryKey: ['prevendas'] });
    },
  });
}
