import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { getCurrentUser } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { resolvePermissions, type Permission } from "@/lib/permissions";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("fisiogest_token"));
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Auth verification failed", error);
        localStorage.removeItem("fisiogest_token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    verifyAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("fisiogest_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setLocation("/");
  };

  const logout = () => {
    localStorage.removeItem("fisiogest_token");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    const perms = resolvePermissions(user.roles ?? []);
    return perms.has(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return (user.roles ?? []).includes(role);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
