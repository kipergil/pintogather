import { createContext, useContext } from "react";
import { useClerk } from "@clerk/clerk-react";
import { useAuth as useAppAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAppAuth();
  const { openSignIn, signOut } = useClerk();

  const value: AuthContextType = {
    user: user ?? null,
    loading: isLoading,
    isAuthenticated,
    login: () => openSignIn(),
    logout: () => signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
