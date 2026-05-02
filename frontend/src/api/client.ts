/**
 * Cliente HTTP do frontend.
 *
 * Em DEV: VITE_API_URL é vazio -> usa proxy do Vite (vite.config.ts)
 * Em PROD: VITE_API_URL é a URL completa do backend Render
 *
 * NOVO: agora os métodos retornam um objeto { ok, data, error } em vez de null.
 * Isso permite mostrar mensagens de erro reais do backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

const STORAGE_KEY_TOKEN = "horacerta_token";
const STORAGE_KEY_USER = "horacerta_user";
const STORAGE_KEY_ACTIVITY = "horacerta_last_activity";
const STORAGE_KEY_REMEMBER = "horacerta_remember";

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token =
      sessionStorage.getItem(STORAGE_KEY_TOKEN) ||
      localStorage.getItem(STORAGE_KEY_TOKEN);
  }

  setToken(token: string, remember: boolean = false) {
    this.token = token;

    if (remember) {
      localStorage.setItem(STORAGE_KEY_REMEMBER, "true");
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_REMEMBER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
    }
  }

  clearToken() {
    this.token = null;
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    sessionStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_ACTIVITY);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_ACTIVITY);
    localStorage.removeItem(STORAGE_KEY_REMEMBER);
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  private url(endpoint: string): string {
    return `${API_BASE}${endpoint}`;
  }

  private handleUnauthorized(res: Response): void {
    if (res.status === 401 && this.token) {
      this.clearToken();
      window.location.href = "/login";
    }
  }

  // ── Helpers internos ──

  /**
   * Extrai mensagem de erro do response.
   * FastAPI retorna: { "detail": "mensagem" } ou { "detail": [...] }
   */
  private async extractError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail) && data.detail[0]?.msg) {
        return data.detail[0].msg;
      }
      return `Erro ${res.status}`;
    } catch {
      return `Erro ${res.status}`;
    }
  }

  // ── Métodos LEGACY (retornam null em erro, mantidos pra compat) ──

  async get<T>(endpoint: string): Promise<T | null> {
    const r = await this.getWithError<T>(endpoint);
    return r.data;
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T | null> {
    const r = await this.postWithError<T>(endpoint, body);
    return r.data;
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T | null> {
    const r = await this.putWithError<T>(endpoint, body);
    return r.data;
  }

  async del<T>(endpoint: string): Promise<T | null> {
    const r = await this.delWithError<T>(endpoint);
    return r.data;
  }

  // ── Métodos NOVOS (retornam ApiResult com erro detalhado) ──

  async getWithError<T>(endpoint: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this.url(endpoint), { headers: this.headers() });
      this.handleUnauthorized(res);
      if (!res.ok) {
        return {
          ok: false,
          data: null,
          error: await this.extractError(res),
          status: res.status,
        };
      }
      const data = await res.json();
      return { ok: true, data, error: null, status: res.status };
    } catch {
      return { ok: false, data: null, error: "Erro de conexão", status: 0 };
    }
  }

  async postWithError<T>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "POST",
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      this.handleUnauthorized(res);
      if (!res.ok) {
        return {
          ok: false,
          data: null,
          error: await this.extractError(res),
          status: res.status,
        };
      }
      const data = await res.json();
      return { ok: true, data, error: null, status: res.status };
    } catch {
      return { ok: false, data: null, error: "Erro de conexão", status: 0 };
    }
  }

  async putWithError<T>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "PUT",
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      this.handleUnauthorized(res);
      if (!res.ok) {
        return {
          ok: false,
          data: null,
          error: await this.extractError(res),
          status: res.status,
        };
      }
      const data = await res.json();
      return { ok: true, data, error: null, status: res.status };
    } catch {
      return { ok: false, data: null, error: "Erro de conexão", status: 0 };
    }
  }

  async delWithError<T>(endpoint: string): Promise<ApiResult<T>> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "DELETE",
        headers: this.headers(),
      });
      this.handleUnauthorized(res);
      if (!res.ok) {
        return {
          ok: false,
          data: null,
          error: await this.extractError(res),
          status: res.status,
        };
      }
      const data = await res.json();
      return { ok: true, data, error: null, status: res.status };
    } catch {
      return { ok: false, data: null, error: "Erro de conexão", status: 0 };
    }
  }

  // ── Login ──

  async loginRequest(
    email: string,
    password: string,
  ): Promise<{ access_token: string; role: string; name: string } | null> {
    try {
      const res = await fetch(this.url("/auth/token"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  getApiBaseUrl(): string {
    return API_BASE;
  }
}

export const api = new ApiClient();
