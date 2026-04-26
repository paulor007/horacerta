/**
 * Cliente HTTP do frontend.
 *
 * Em DEV: VITE_API_URL é vazio -> usa proxy do Vite (vite.config.ts)
 * Em PROD: VITE_API_URL é a URL completa do backend Railway
 *          ex: https://horacerta-backend.up.railway.app
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

const STORAGE_KEY_TOKEN = "horacerta_token";
const STORAGE_KEY_USER = "horacerta_user";
const STORAGE_KEY_ACTIVITY = "horacerta_last_activity";
const STORAGE_KEY_REMEMBER = "horacerta_remember";

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

  async get<T>(endpoint: string): Promise<T | null> {
    try {
      const res = await fetch(this.url(endpoint), { headers: this.headers() });
      this.handleUnauthorized(res);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "POST",
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      this.handleUnauthorized(res);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "PUT",
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      this.handleUnauthorized(res);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async del<T>(endpoint: string): Promise<T | null> {
    try {
      const res = await fetch(this.url(endpoint), {
        method: "DELETE",
        headers: this.headers(),
      });
      this.handleUnauthorized(res);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

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

  /** URL pública absoluta (para WebSocket, downloads, imagens, etc) */
  getApiBaseUrl(): string {
    return API_BASE;
  }
}

export const api = new ApiClient();
