import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

// Create client with service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Starting database migration with service role...');

async function createTables() {
  const migrations = [
    {
      name: 'profiles',
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL UNIQUE,
          full_name TEXT NOT NULL,
          twitter_handle TEXT,
          instagram_handle TEXT,
          linkedin_handle TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `
    },
    {
      name: 'map_collections',
      sql: `
        CREATE TABLE IF NOT EXISTS map_collections (
          id VARCHAR(255) PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          share_url TEXT NOT NULL UNIQUE,
          owner_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `
    },
    {
      name: 'map_viewers',
      sql: `
        CREATE TABLE IF NOT EXISTS map_viewers (
          id VARCHAR(255) PRIMARY KEY,
          map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `
    },
    {
      name: 'pins',
      sql: `
        CREATE TABLE IF NOT EXISTS pins (
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
        );
      `
    }
  ];

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_map_collections_owner_id ON map_collections(owner_id);',
    'CREATE INDEX IF NOT EXISTS idx_map_collections_share_url ON map_collections(share_url);',
    'CREATE INDEX IF NOT EXISTS idx_map_viewers_map_id ON map_viewers(map_id);',
    'CREATE INDEX IF NOT EXISTS idx_map_viewers_user_id ON map_viewers(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_pins_map_id ON pins(map_id);',
    'CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);'
  ];

  let successCount = 0;
  let errorCount = 0;

  // Create tables
  for (const migration of migrations) {
    try {
      console.log(`Creating table: ${migration.name}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: migration.sql.trim() 
      });

      if (error) {
        console.log(`Error creating ${migration.name}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✓ Successfully created table: ${migration.name}`);
        successCount++;
      }
    } catch (err) {
      console.log(`Exception creating ${migration.name}: ${err.message}`);
      errorCount++;
    }
  }

  // Create indexes
  console.log('\nCreating indexes...');
  for (const index of indexes) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql: index.trim() 
      });

      if (error) {
        console.log(`Index creation warning: ${error.message}`);
      } else {
        console.log('✓ Index created successfully');
      }
    } catch (err) {
      console.log(`Index creation exception: ${err.message}`);
    }
  }

  console.log(`\nMigration completed: ${successCount} tables created, ${errorCount} errors`);
  
  if (successCount > 0) {
    console.log('Database schema setup successful!');
  }
}

createTables().catch(error => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});