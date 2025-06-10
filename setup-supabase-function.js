import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('Creating exec_sql function in Supabase...');

// First create the exec_sql function
const createFunctionSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
  RETURN 'Success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$;
`;

async function setupFunction() {
  try {
    // Use direct SQL execution via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createFunctionSQL })
    });

    if (!response.ok) {
      // Function doesn't exist, create it via direct connection
      console.log('Function creation via RPC failed, trying alternative approach...');
      
      // Try to create tables directly without the function
      await createTablesDirectly();
    } else {
      console.log('exec_sql function created successfully');
      await runMigrations();
    }
  } catch (error) {
    console.log('Setting up function failed, creating tables directly...');
    await createTablesDirectly();
  }
}

async function createTablesDirectly() {
  console.log('Creating tables directly via Supabase client...');
  
  const tables = [
    {
      name: 'profiles',
      check: () => supabase.from('profiles').select('count').limit(1)
    },
    {
      name: 'map_collections', 
      check: () => supabase.from('map_collections').select('count').limit(1)
    },
    {
      name: 'map_viewers',
      check: () => supabase.from('map_viewers').select('count').limit(1)
    },
    {
      name: 'pins',
      check: () => supabase.from('pins').select('count').limit(1)
    }
  ];

  for (const table of tables) {
    try {
      const { data, error } = await table.check();
      
      if (error && error.code === '42P01') {
        console.log(`Table ${table.name} does not exist - needs manual creation`);
      } else if (error) {
        console.log(`Error checking ${table.name}: ${error.message}`);
      } else {
        console.log(`Table ${table.name} already exists`);
      }
    } catch (err) {
      console.log(`Exception checking ${table.name}: ${err.message}`);
    }
  }

  console.log('\nTo complete setup, run the SQL from supabase-migration.sql in your Supabase SQL Editor');
}

async function runMigrations() {
  console.log('Running migrations with exec_sql function...');
  
  const migrations = [
    `CREATE TABLE IF NOT EXISTS profiles (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      twitter_handle TEXT,
      instagram_handle TEXT,
      linkedin_handle TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS map_collections (
      id VARCHAR(255) PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      share_url TEXT NOT NULL UNIQUE,
      owner_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS map_viewers (
      id VARCHAR(255) PRIMARY KEY,
      map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS pins (
      id VARCHAR(255) PRIMARY KEY,
      map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
      user_id VARCHAR(255),
      user_name TEXT NOT NULL,
      latitude DECIMAL(10,8) NOT NULL,
      longitude DECIMAL(11,8) NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT,
      town TEXT,
      borough TEXT,
      postcode TEXT,
      country TEXT,
      twitter_handle TEXT,
      instagram_handle TEXT,
      linkedin_handle TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );`
  ];

  for (const sql of migrations) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.log(`Migration error: ${error.message}`);
      } else {
        console.log('Migration executed successfully');
      }
    } catch (err) {
      console.log(`Migration exception: ${err.message}`);
    }
  }
}

setupFunction();