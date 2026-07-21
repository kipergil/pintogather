import { useAuth } from "@/contexts/AuthContext";

export interface UserPermissions {
  canExportCSV: boolean;
  canUseVenueSearch: boolean;
  userGroup: string;
}

/**
 * Paid tiers aren't billed yet, so every signed-in feature is unlocked for
 * all user groups for now. `userGroup` is kept around for the admin panel
 * and future billing work.
 */
export function useUserPermissions(): UserPermissions {
  const { user } = useAuth();

  return {
    canExportCSV: true,
    canUseVenueSearch: true,
    userGroup: user?.userGroup || "freemium",
  };
}
