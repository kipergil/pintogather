import { useAuth } from "@/contexts/AuthContext";

export interface UserPermissions {
  canExportCSV: boolean;
  canUseVenueSearch: boolean;
  userGroup: string;
}

export function useUserPermissions(): UserPermissions {
  const { user } = useAuth();
  const userGroup = user?.userGroup || "freemium";

  return {
    canExportCSV: userGroup === "basic" || userGroup === "premium",
    canUseVenueSearch: userGroup === "basic" || userGroup === "premium",
    userGroup,
  };
}
