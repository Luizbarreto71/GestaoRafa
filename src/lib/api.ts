import axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * A API roda no mesmo domínio do site (função serverless da Vercel em
 * `/api`), então o caminho é relativo e não existe variável de ambiente no
 * frontend. Em desenvolvimento, o Vite faz proxy de `/api` para o servidor
 * local na porta 4000.
 */
export const API_URL = '/api';

export const STORAGE_KEYS = {
  token: 'rafa:token',
  refreshToken: 'rafa:refreshToken',
  user: 'rafa:user',
  theme: 'rafa:theme',
  offlineQueue: 'rafa:offlineQueue',
  sidebar: 'rafa:sidebarCollapsed',
} as const;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Extrai a mensagem de erro amigável enviada pela API. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; details?: { field: string; message: string }[] }
      | undefined;

    if (data?.details?.length) {
      return data.details.map((d) => d.message).join(' · ');
    }
    if (data?.error) return data.error;
    if (error.code === 'ERR_NETWORK') {
      return 'Sem conexão com o servidor. Verifique sua internet.';
    }
    if (error.code === 'ECONNABORTED') return 'A requisição demorou demais. Tente novamente.';
  }
  if (error instanceof Error) return error.message;
  return 'Ocorreu um erro inesperado';
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    localStorage.setItem(STORAGE_KEYS.token, data.token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
    return data.token as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthRoute = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;

      // Uma única renovação por vez, compartilhada por todas as chamadas.
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;

      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }

      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.refreshToken);
      localStorage.removeItem(STORAGE_KEYS.user);

      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

/** Baixa um arquivo gerado pela API (relatórios, backup, modelo de planilha). */
export async function downloadFile(
  url: string,
  params: Record<string, unknown> = {},
  fallbackName = 'arquivo',
): Promise<void> {
  const response = await api.get(url, { params, responseType: 'blob' });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^";]+)"?/);
  const filename = match?.[1] ?? fallbackName;

  const href = URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
