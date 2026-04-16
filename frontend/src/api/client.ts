class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("horacerta_token");
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("horacerta_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("horacerta_token");
    localStorage.removeItem("horacerta_user");
    localStorage.removeItem("horacerta_last_activity");
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (this.token) {
      h["Authorization"] = `Bearer ${this.token}`;
    }
    return h;
  }

  private handleUnauthorized(res: Response): void {
    // Se o backend retornar 401, força logout (token expirou ou inválido)
    if (res.status === 401 && this.token) {
      this.clearToken();
      window.location.href = "/login";
    }
  }

  async get<T>(endpoint: string): Promise<T | null> {
    try {
      const res = await fetch(endpoint, { headers: this.headers() });
      this.handleUnauthorized(res);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(endpoint, {
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
      const res = await fetch(endpoint, {
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
      const res = await fetch(endpoint, {
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
      const res = await fetch("/auth/token", {
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
}

export const api = new ApiClient();
