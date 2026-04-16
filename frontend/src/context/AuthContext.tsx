import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../api/client";

// Tempo de inatividade para auto-logout (15 minutos)
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

interface AuthUser {
  name: string;
  role: string;
  email: string;
  phone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: (data: {
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getInitialUser(): AuthUser | null {
  const saved = localStorage.getItem("horacerta_user");
  const token = localStorage.getItem("horacerta_token");

  if (!saved || !token) return null;

  // Verificar se token JWT expirou (decodifica payload)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      // Token expirado — limpar sessão
      localStorage.removeItem("horacerta_token");
      localStorage.removeItem("horacerta_user");
      localStorage.removeItem("horacerta_last_activity");
      return null;
    }
  } catch {
    // Token malformado
    localStorage.removeItem("horacerta_token");
    localStorage.removeItem("horacerta_user");
    return null;
  }

  // Verificar inatividade
  const lastActivity = localStorage.getItem("horacerta_last_activity");
  if (lastActivity) {
    const elapsed = Date.now() - parseInt(lastActivity);
    if (elapsed > SESSION_TIMEOUT_MS) {
      localStorage.removeItem("horacerta_token");
      localStorage.removeItem("horacerta_user");
      localStorage.removeItem("horacerta_last_activity");
      return null;
    }
  }

  return JSON.parse(saved);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);

  const logout = useCallback(() => {
    api.clearToken();
    localStorage.removeItem("horacerta_last_activity");
    setUser(null);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const data = await api.loginRequest(email, password);
    if (!data) return false;

    api.setToken(data.access_token);
    const authUser: AuthUser = { name: data.name, role: data.role, email };
    setUser(authUser);
    localStorage.setItem("horacerta_user", JSON.stringify(authUser));
    localStorage.setItem("horacerta_last_activity", String(Date.now()));
    return true;
  };

  const refreshUser = (data: {
    name: string;
    email: string;
    phone?: string | null;
  }) => {
    if (!user) return;
    const updated = {
      ...user,
      name: data.name,
      email: data.email,
      phone: data.phone || undefined,
    };
    setUser(updated);
    localStorage.setItem("horacerta_user", JSON.stringify(updated));
  };

  // Tracker de atividade — atualiza timestamp a cada interação
  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      localStorage.setItem("horacerta_last_activity", String(Date.now()));
    };

    // Registra atividade em cliques, teclas e scroll
    window.addEventListener("click", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("scroll", updateActivity);

    // Verifica inatividade a cada minuto
    const interval = setInterval(() => {
      const lastActivity = localStorage.getItem("horacerta_last_activity");
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity);
        if (elapsed > SESSION_TIMEOUT_MS) {
          logout();
          window.location.href = "/login";
        }
      }
    }, 60_000);

    return () => {
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      clearInterval(interval);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
