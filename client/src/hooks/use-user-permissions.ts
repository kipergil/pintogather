import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabase } from "@/lib/supabase";

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
      
      // Try to load from localStorage first
      const localProfile = localStorage.getItem(`profile_${user.id}`);
      if (localProfile) {
        return JSON.parse(localProfile);
      }
      
      // Try Supabase as fallback
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (!error && data) {
            return data;
          }
        } catch (error) {
          console.log('No profile found in Supabase');
        }
      }
      
      return null;
    },
    enabled: !!user,
  });

  const userGroup = profile?.user_group || 'freemium';

  return {
    canExportCSV: userGroup === 'basic' || userGroup === 'premium',
    canUseVenueSearch: userGroup === 'basic' || userGroup === 'premium',
    userGroup
  };
}