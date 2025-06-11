import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPermissions {
  canExportCSV: boolean;
  canUseVenueSearch: boolean;
  userGroup: string;
}

export function useUserPermissions(): UserPermissions {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      try {
        const response = await fetch(`/api/profile/${user.id}`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.log('No profile found in database');
      }
      
      return null;
    },
    enabled: !!user,
  });

  const userGroup = profile?.userGroup || 'freemium';

  return {
    canExportCSV: userGroup === 'basic' || userGroup === 'premium',
    canUseVenueSearch: userGroup === 'basic' || userGroup === 'premium',
    userGroup
  };
}