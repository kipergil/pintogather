import { createClient } from '@supabase/supabase-js'

// Get configuration from API endpoint
let supabaseClient: any = null;

async function initializeSupabase() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    
    if (config.supabaseUrl && config.supabaseAnonKey) {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
  }
}

// Initialize on module load
initializeSupabase();

export const getSupabase = () => {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Please ensure configuration is available.');
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