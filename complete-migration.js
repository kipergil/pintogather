import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function executeDirectSQL() {
  console.log('Executing direct SQL migrations...');
  
  // Create a simple test to execute SQL
  const sqlCommands = [
    `CREATE TABLE IF NOT EXISTS test_migration (id SERIAL PRIMARY KEY, name TEXT);`,
    `INSERT INTO test_migration (name) VALUES ('migration_test');`,
    `DROP TABLE IF EXISTS test_migration;`
  ];

  for (const sql of sqlCommands) {
    try {
      const response = await fetch(`${supabaseUrl}/sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
      });

      console.log(`SQL execution response: ${response.status}`);
      
      if (response.ok) {
        console.log('SQL executed successfully');
      } else {
        const error = await response.text();
        console.log('SQL execution failed:', error);
      }
    } catch (error) {
      console.log('SQL execution exception:', error.message);
    }
  }

  // Alternative: Use PostgreSQL connection if available
  if (process.env.DATABASE_URL) {
    console.log('Attempting direct PostgreSQL connection...');
    try {
      const postgres = await import('postgres');
      const sql = postgres.default(process.env.DATABASE_URL);
      
      await sql`
        CREATE TABLE IF NOT EXISTS map_viewers (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
          map_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS pins (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
          map_id VARCHAR(255) NOT NULL,
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
      `;
      
      console.log('PostgreSQL direct migration completed');
      await sql.end();
      
    } catch (error) {
      console.log('PostgreSQL connection failed:', error.message);
    }
  }
}

executeDirectSQL();