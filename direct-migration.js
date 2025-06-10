import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('Running direct table creation...');

async function createTablesDirectly() {
  const results = [];

  // Create profiles table by inserting and deleting a test record
  try {
    console.log('Testing profiles table...');
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: 'test-profile',
        user_id: 'test-user',
        full_name: 'Test User'
      })
      .select();

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Profiles table does not exist');
        results.push({ table: 'profiles', status: 'missing', error: error.message });
      } else {
        console.log('⚠️ Profiles table exists but has issues:', error.message);
        results.push({ table: 'profiles', status: 'exists_with_issues', error: error.message });
      }
    } else {
      console.log('✅ Profiles table exists and working');
      results.push({ table: 'profiles', status: 'exists' });
      
      // Clean up test record
      await supabase
        .from('profiles')
        .delete()
        .eq('id', 'test-profile');
    }
  } catch (err) {
    console.log('Exception testing profiles:', err.message);
    results.push({ table: 'profiles', status: 'error', error: err.message });
  }

  // Test map_collections table
  try {
    console.log('Testing map_collections table...');
    const { data, error } = await supabase
      .from('map_collections')
      .insert({
        id: 'test-map',
        name: 'Test Map',
        share_url: 'test-url'
      })
      .select();

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Map collections table does not exist');
        results.push({ table: 'map_collections', status: 'missing', error: error.message });
      } else {
        console.log('⚠️ Map collections table exists but has issues:', error.message);
        results.push({ table: 'map_collections', status: 'exists_with_issues', error: error.message });
      }
    } else {
      console.log('✅ Map collections table exists and working');
      results.push({ table: 'map_collections', status: 'exists' });
      
      // Clean up test record
      await supabase
        .from('map_collections')
        .delete()
        .eq('id', 'test-map');
    }
  } catch (err) {
    console.log('Exception testing map_collections:', err.message);
    results.push({ table: 'map_collections', status: 'error', error: err.message });
  }

  // Test pins table
  try {
    console.log('Testing pins table...');
    const { data, error } = await supabase
      .from('pins')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Pins table does not exist');
        results.push({ table: 'pins', status: 'missing', error: error.message });
      } else {
        console.log('⚠️ Pins table exists but has issues:', error.message);
        results.push({ table: 'pins', status: 'exists_with_issues', error: error.message });
      }
    } else {
      console.log('✅ Pins table exists and working');
      results.push({ table: 'pins', status: 'exists' });
    }
  } catch (err) {
    console.log('Exception testing pins:', err.message);
    results.push({ table: 'pins', status: 'error', error: err.message });
  }

  // Test map_viewers table
  try {
    console.log('Testing map_viewers table...');
    const { data, error } = await supabase
      .from('map_viewers')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Map viewers table does not exist');
        results.push({ table: 'map_viewers', status: 'missing', error: error.message });
      } else {
        console.log('⚠️ Map viewers table exists but has issues:', error.message);
        results.push({ table: 'map_viewers', status: 'exists_with_issues', error: error.message });
      }
    } else {
      console.log('✅ Map viewers table exists and working');
      results.push({ table: 'map_viewers', status: 'exists' });
    }
  } catch (err) {
    console.log('Exception testing map_viewers:', err.message);
    results.push({ table: 'map_viewers', status: 'error', error: err.message });
  }

  console.log('\n📊 Database Status Summary:');
  console.log('===========================');
  
  const missingTables = results.filter(r => r.status === 'missing');
  const existingTables = results.filter(r => r.status === 'exists');
  const problematicTables = results.filter(r => r.status === 'exists_with_issues' || r.status === 'error');

  if (existingTables.length > 0) {
    console.log('✅ Existing tables:', existingTables.map(t => t.table).join(', '));
  }

  if (missingTables.length > 0) {
    console.log('❌ Missing tables:', missingTables.map(t => t.table).join(', '));
    console.log('\nTo create missing tables, run the SQL migration script in your Supabase SQL Editor:');
    console.log('File: supabase-migration.sql');
  }

  if (problematicTables.length > 0) {
    console.log('⚠️ Tables with issues:', problematicTables.map(t => `${t.table} (${t.error})`).join(', '));
  }

  return results;
}

createTablesDirectly().then(results => {
  const allTablesExist = results.every(r => r.status === 'exists');
  if (allTablesExist) {
    console.log('\n🎉 All database tables are properly set up!');
  } else {
    console.log('\n📝 Manual migration required. Please run the SQL from supabase-migration.sql');
  }
}).catch(error => {
  console.error('Migration check failed:', error.message);
});