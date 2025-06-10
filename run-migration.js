import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

console.log('Starting database migration...');

async function executeSQLStatements() {
  // Individual table creation statements
  const statements = [
    {
      name: 'profiles',
      sql: `CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        twitter_handle TEXT,
        instagram_handle TEXT,
        linkedin_handle TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );`
    },
    {
      name: 'map_collections',
      sql: `CREATE TABLE IF NOT EXISTS map_collections (
        id VARCHAR(255) PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        share_url TEXT NOT NULL UNIQUE,
        owner_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );`
    },
    {
      name: 'map_viewers',
      sql: `CREATE TABLE IF NOT EXISTS map_viewers (
        id VARCHAR(255) PRIMARY KEY,
        map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );`
    },
    {
      name: 'pins',
      sql: `CREATE TABLE IF NOT EXISTS pins (
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
    }
  ];

  for (const statement of statements) {
    try {
      console.log(`Creating table: ${statement.name}...`);
      
      // Try to execute via REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: statement.sql })
      });

      if (response.ok) {
        console.log(`✓ Created table: ${statement.name}`);
      } else {
        const error = await response.text();
        console.log(`⚠ Table ${statement.name}: ${error}`);
        
        // Try alternative approach by checking if table exists
        const { data, error: checkError } = await supabase
          .from(statement.name)
          .select('*')
          .limit(1);
          
        if (!checkError) {
          console.log(`✓ Table ${statement.name} already exists`);
        } else if (checkError.code === '42P01') {
          console.log(`⚠ Table ${statement.name} needs manual creation`);
        }
      }
    } catch (error) {
      console.log(`⚠ Error with ${statement.name}: ${error.message}`);
    }
  }
}

executeSQLStatements().then(() => {
  console.log('Migration process completed');
}).catch(error => {
  console.error('Migration failed:', error.message);
});