import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create admin client with service role
const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('Creating missing database tables...');

async function createMissingTables() {
  // SQL for missing tables
  const tableDefinitions = [
    {
      name: 'map_viewers',
      sql: `
        CREATE TABLE IF NOT EXISTS map_viewers (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
          map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role TEXT NOT NULL DEFAULT 'viewer',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_map_viewers_map_id ON map_viewers(map_id);
        CREATE INDEX IF NOT EXISTS idx_map_viewers_user_id ON map_viewers(user_id);
      `
    },
    {
      name: 'pins',
      sql: `
        CREATE TABLE IF NOT EXISTS pins (
          id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        
        CREATE INDEX IF NOT EXISTS idx_pins_map_id ON pins(map_id);
        CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);
      `
    }
  ];

  const results = [];

  for (const table of tableDefinitions) {
    try {
      console.log(`Creating ${table.name} table...`);
      
      // Use direct HTTP request to Supabase's SQL endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ 
          query: table.sql.trim()
        })
      });

      if (response.ok) {
        console.log(`✅ Successfully created ${table.name}`);
        results.push({ table: table.name, status: 'created' });
      } else {
        const errorText = await response.text();
        console.log(`⚠️ ${table.name} creation response: ${response.status} - ${errorText}`);
        results.push({ table: table.name, status: 'attempted', response: errorText });
      }
    } catch (error) {
      console.log(`❌ Error creating ${table.name}: ${error.message}`);
      results.push({ table: table.name, status: 'failed', error: error.message });
    }
  }

  // Verify tables were created
  console.log('\nVerifying table creation...');
  
  for (const table of ['map_viewers', 'pins']) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${table} still missing`);
        } else {
          console.log(`⚠️ ${table} has issues: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table} verified working`);
      }
    } catch (err) {
      console.log(`Exception verifying ${table}: ${err.message}`);
    }
  }

  return results;
}

createMissingTables().then(results => {
  console.log('\n📊 Table Creation Results:');
  results.forEach(result => {
    console.log(`  ${result.table}: ${result.status}`);
  });
}).catch(error => {
  console.error('Table creation failed:', error);
});