// src/store/auth.store.ts
import { create } from "zustand";
import { api } from "../services/api";

type Role =
  | "ADMIN"
  | "CASHIER"
  | "TECHNICIAN"
  | "TECHNICIAN_DELIVERY"
  | "DELIVERY"
  | "CLIENT"
  | "MANAGER"
  | "SELLER"
  | "SUPPORT";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

interface AuthState {
  user:            User | null;
  token:           string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;
  // Acciones
  setUser:         (user: User, token: string, refreshToken?: string) => void;
  logout:          () => void;
  refreshSession:  () => Promise<boolean>;
}

// ── Timer global para el refresh automático ──────────────
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// 55 minutos — refresca 5 min antes de que expire la hora
const REFRESH_INTERVAL_MS = 55 * 60 * 1000;

function scheduleRefresh(refreshFn: () => Promise<boolean>) {
  // Cancela timer anterior si existe
  if (refreshTimer) clearTimeout(refreshTimer);

  refreshTimer = setTimeout(async () => {
    const success = await refreshFn();
    if (success) {
      // Si refrescó bien, programa el siguiente
      scheduleRefresh(refreshFn);
    }
    // Si falló, el usuario tendrá que iniciar sesión de nuevo
  }, REFRESH_INTERVAL_MS);
}

// ── Store ─────────────────────────────────────────────────
export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  token:           null,
  refreshToken:    null,
  isAuthenticated: false,

  // Guarda usuario y programa refresh automático
  setUser: (user, token, refreshToken?) => {
    set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true });

    // Solo programa refresh si tenemos refresh token
    if (refreshToken) {
      scheduleRefresh(() => get().refreshSession());
    }
  },

  // Cierra sesión y cancela el timer
  logout: () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },

  // Refresca el token con Cognito vía backend
  refreshSession: async (): Promise<boolean> => {
    const { refreshToken } = get();
    if (!refreshToken) return false;

    try {
      const response = await api.post("/api/auth/refresh", { refreshToken });
      const { token: newToken } = response.data.data;

      // Actualiza solo el token, mantiene usuario y refreshToken
      set({ token: newToken });

      // Actualiza el header de axios con el nuevo token
      api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

      console.log("✅ Token renovado automáticamente");
      return true;
    } catch (error) {
      console.log("❌ No se pudo renovar el token — cerrando sesión");
      get().logout();
      return false;
    }
  },
}));