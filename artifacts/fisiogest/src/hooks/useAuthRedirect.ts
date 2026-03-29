import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/use-auth";

export function useAuthRedirect(redirectTo = "/dashboard") {
  const { token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && token) {
      setLocation(redirectTo);
    }
  }, [token, isLoading, redirectTo, setLocation]);

  return { isAuthenticated: !!token, isLoading };
}
