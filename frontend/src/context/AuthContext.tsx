import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../api/client";

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const STORAGE_KEY_TOKEN = "horacerta_token";
const STORAGE_KEY_USER = "horacerta_user";
const STORAGE_KEY_ACTIVITY = "horacerta_last_activity";
const STORAGE_KEY_REMEMBER = "horacerta_remember";

interface AuthUser {
  name: string;
  role: string;
  email: string;
  phone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<boolean>;
  logout: () => void;
  refreshUser: (data: {
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStorage(): Storage {
  return localStorage.getItem(STORAGE_KEY_REMEMBER) === "true"
    ? localStorage
    : sessionStorage;
}

function getInitialUser(): AuthUser | null {
  // Verifica em sessionStorage e localStorage
  const storage = getStorage();
  const saved =
    storage.getItem(STORAGE_KEY_USER) ||
    sessionStorage.getItem(STORAGE_KEY_USER);
  const token =
    storage.getItem(STORAGE_KEY_TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY_TOKEN);

  if (!saved || !token) return null;

  // Verificar JWT expirado
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      api.clearToken();
      return null;
    }
  } catch {
    api.clearToken();
    return null;
  }

  // Verificar inatividade
  const lastActivity =
    storage.getItem(STORAGE_KEY_ACTIVITY) ||
    sessionStorage.getItem(STORAGE_KEY_ACTIVITY);
  if (lastActivity) {
    const elapsed = Date.now() - parseInt(lastActivity);
    if (elapsed > SESSION_TIMEOUT_MS) {
      api.clearToken();
      return null;
    }
  }

  return JSON.parse(saved);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
  }, []);

  const login = async (
    email: string,
    password: string,
    remember: boolean = false,
  ): Promise<boolean> => {
    const data = await api.loginRequest(email, password);
    if (!data) return false;

    api.setToken(data.access_token, remember);

    const storage = remember ? localStorage : sessionStorage;
    const authUser: AuthUser = { name: data.name, role: data.role, email };
    setUser(authUser);
    storage.setItem(STORAGE_KEY_USER, JSON.stringify(authUser));
    storage.setItem(STORAGE_KEY_ACTIVITY, String(Date.now()));
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
    const storage = getStorage();
    storage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
  };

  // Activity tracker + inactivity check
  useEffect(() => {
    if (!user) return;

    const storage = getStorage();

    const updateActivity = () => {
      storage.setItem(STORAGE_KEY_ACTIVITY, String(Date.now()));
    };

    window.addEventListener("click", updateActivity);
    window.addEventListener("keydown", updateActivity);

    const interval = setInterval(() => {
      const lastActivity = storage.getItem(STORAGE_KEY_ACTIVITY);
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
