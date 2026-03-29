import { createContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { getCurrentUser } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { resolvePermissions, type Permission } from "@/lib/permissions";

export interface ClinicInfo {
  id: number;
  name: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  clinicId: number | null;
  clinics: ClinicInfo[];
  isSuperAdmin: boolean;
  login: (token: string, user: User, clinics?: ClinicInfo[]) => void;
  logout: () => void;
  switchClinic: (clinicId: number) => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("fisiogest_token"));
  const [isLoading, setIsLoading] = useState(true);
  const [clinicId, setClinicId] = useState<number | null>(() => {
    const stored = localStorage.getItem("fisiogest_clinic_id");
    return stored ? parseInt(stored) : null;
  });
  const [clinics, setClinics] = useState<ClinicInfo[]>(() => {
    const stored = localStorage.getItem("fisiogest_clinics");
    return stored ? JSON.parse(stored) : [];
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    async function verifyAuth() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await getCurrentUser() as any;
        setUser(userData);
        setIsSuperAdmin(userData.isSuperAdmin ?? false);
        if (userData.clinicId !== undefined) setClinicId(userData.clinicId);
        if (userData.clinics) {
          setClinics(userData.clinics);
          localStorage.setItem("fisiogest_clinics", JSON.stringify(userData.clinics));
        }
      } catch (error) {
        console.error("Auth verification failed", error);
        localStorage.removeItem("fisiogest_token");
        localStorage.removeItem("fisiogest_clinic_id");
        localStorage.removeItem("fisiogest_clinics");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    verifyAuth();
  }, [token]);

  const login = (newToken: string, newUser: User, newClinics?: ClinicInfo[]) => {
    localStorage.setItem("fisiogest_token", newToken);
    const userData = newUser as any;
    const clinicIdVal = userData.clinicId ?? null;
    const isSA = userData.isSuperAdmin ?? false;

    if (clinicIdVal) localStorage.setItem("fisiogest_clinic_id", String(clinicIdVal));
    if (newClinics) localStorage.setItem("fisiogest_clinics", JSON.stringify(newClinics));

    setToken(newToken);
    setUser(newUser);
    setClinicId(clinicIdVal);
    setIsSuperAdmin(isSA);
    if (newClinics) setClinics(newClinics);
    setLocation("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("fisiogest_token");
    localStorage.removeItem("fisiogest_clinic_id");
    localStorage.removeItem("fisiogest_clinics");
    setToken(null);
    setUser(null);
    setClinicId(null);
    setClinics([]);
    setIsSuperAdmin(false);
    setLocation("/login");
  };

  const switchClinic = async (newClinicId: number) => {
    try {
      const res = await fetch(`/api/auth/switch-clinic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: newClinicId === 0 ? null : newClinicId }),
      });
      if (!res.ok) throw new Error("Failed to switch clinic");
      const data = await res.json();
      localStorage.setItem("fisiogest_token", data.token);
      if (data.clinicId) {
        localStorage.setItem("fisiogest_clinic_id", String(data.clinicId));
      } else {
        localStorage.removeItem("fisiogest_clinic_id");
      }
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Failed to switch clinic", err);
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    const perms = resolvePermissions((user as any).roles ?? [], isSuperAdmin);
    return perms.has(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    if (role === "super_admin") return isSuperAdmin;
    return ((user as any).roles ?? []).includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        clinicId,
        clinics,
        isSuperAdmin,
        login,
        logout,
        switchClinic,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

