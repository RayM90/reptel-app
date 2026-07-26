import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  address?: string;
  clientId?: string;
  role: Role;
}

interface AuthState {
  user:            User | null;
  token:           string | null;
  refreshToken:    string | null;
  isAuthenticated: boolean;
  setUser:         (user: User, token: string, refreshToken?: string) => void;
  logout:          () => void;
  refreshSession:  () => Promise<boolean>;
  resumeSession:   () => Promise<void>;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_INTERVAL_MS = 55 * 60 * 1000;

function scheduleRefresh(refreshFn: () => Promise<boolean>) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const success = await refreshFn();
    if (success) scheduleRefresh(refreshFn);
  }, REFRESH_INTERVAL_MS);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:            null,
      token:           null,
      refreshToken:    null,
      isAuthenticated: false,

      setUser: (user, token, refreshToken?) => {
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true });
        if (refreshToken) {
          scheduleRefresh(() => get().refreshSession());
        }
      },

      logout: () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },

      refreshSession: async (): Promise<boolean> => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const response = await api.post("/api/auth/refresh", { refreshToken });
          const { token: newToken } = response.data.data;
          set({ token: newToken });
          console.log("✅ Token renovado automáticamente");
          return true;
        } catch (error) {
          console.log("❌ No se pudo renovar el token — cerrando sesión");
          get().logout();
          return false;
        }
      },

      resumeSession: async (): Promise<void> => {
        const { refreshToken, isAuthenticated } = get();
        if (!isAuthenticated || !refreshToken) return;
        const success = await get().refreshSession();
        if (success) {
          scheduleRefresh(() => get().refreshSession());
        }
      },
    }),
    {
      name: "reptel-auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
