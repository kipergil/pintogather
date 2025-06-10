import { createClient } from '@supabase/supabase-js'

// Get configuration from API endpoint
let supabaseClient: any = null;
let isInitialized = false;

async function initializeSupabase() {
  if (isInitialized) return;
  
  try {
    const response = await fetch('/api/config');
    
    if (!response.ok) {
      if (response.status === 503) {
        const errorData = await response.json();
        console.warn('Authentication service not configured:', errorData.message);
      } else {
        throw new Error(`Config API returned ${response.status}`);
      }
    } else {
      const config = await response.json();
      
      if (config.supabaseUrl && config.supabaseAnonKey) {
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          }
        });
        console.log('Supabase initialized successfully');
      } else {
        console.warn('Supabase configuration not available');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
  } finally {
    isInitialized = true;
  }
}

// Initialize immediately
initializeSupabase();

export const getSupabase = () => {
  if (!supabaseClient) {
    console.warn('Supabase client not initialized yet');
    return null;
  }
  return supabaseClient;
};

// For backward compatibility
export const supabase = new Proxy({}, {
  get(target, prop) {
    return getSupabase()[prop];
  }
});

export type Profile = {
  id: string
  user_id: string
  full_name: string
  twitter_handle?: string
  instagram_handle?: string
  linkedin_handle?: string
  created_at: string
  updated_at: string
}