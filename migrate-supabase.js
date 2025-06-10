#!/usr/bin/env node

// Supabase Database Migration Script
// This script sets up the required database tables in Supabase

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please ensure SUPABASE_URL and SUPABASE_ANON_KEY environment variables are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🚀 Starting Supabase database migration...');

async function runMigration() {
  const results = {
    success: [],
    errors: [],
    warnings: []
  };

  // SQL statements for table creation
  const tables = [
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

  // Test connection first
  try {
    console.log('🔍 Testing Supabase connection...');
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message !== 'Invalid JWT') {
      throw new Error(`Connection test failed: ${error.message}`);
    }
    console.log('✅ Supabase connection successful');
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    return;
  }

  // Execute table creation
  for (const table of tables) {
    try {
      console.log(`📝 Creating table: ${table.name}...`);
      
      // First check if table exists by trying to query it
      const { data: existsData, error: existsError } = await supabase
        .from(table.name)
        .select('count')
        .limit(1);

      if (existsError && existsError.code === '42P01') {
        // Table doesn't exist, create it
        console.log(`   Table ${table.name} doesn't exist, creating...`);
        
        // Use RPC to execute raw SQL (if available)
        const { data: createData, error: createError } = await supabase
          .rpc('exec_sql', { sql: table.sql.trim() });

        if (createError) {
          // If RPC method doesn't exist, this is expected in some Supabase setups
          if (createError.code === '42883') {
            results.warnings.push(`Cannot create ${table.name} automatically - RPC function not available. Manual creation required.`);
            console.log(`⚠️  Warning: ${table.name} requires manual creation (RPC not available)`);
          } else {
            results.errors.push(`Failed to create ${table.name}: ${createError.message}`);
            console.log(`❌ Error creating ${table.name}: ${createError.message}`);
          }
        } else {
          results.success.push(`Created table: ${table.name}`);
          console.log(`✅ Created table: ${table.name}`);
        }
      } else if (existsError) {
        results.errors.push(`Error checking ${table.name}: ${existsError.message}`);
        console.log(`❌ Error checking ${table.name}: ${existsError.message}`);
      } else {
        results.success.push(`Table ${table.name} already exists`);
        console.log(`✅ Table ${table.name} already exists`);
      }
    } catch (error) {
      results.errors.push(`Unexpected error for ${table.name}: ${error.message}`);
      console.log(`❌ Unexpected error for ${table.name}: ${error.message}`);
    }
  }

  // Print summary
  console.log('\n📊 Migration Summary:');
  console.log('==================');
  
  if (results.success.length > 0) {
    console.log('✅ Successful operations:');
    results.success.forEach(msg => console.log(`   • ${msg}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(msg => console.log(`   • ${msg}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(msg => console.log(`   • ${msg}`));
  }

  // If manual creation is needed, show SQL
  if (results.warnings.length > 0) {
    console.log('\n📝 Manual SQL to run in Supabase SQL Editor:');
    console.log('==============================================');
    tables.forEach(table => {
      console.log(`-- ${table.name.toUpperCase()} TABLE`);
      console.log(table.sql.trim());
      console.log('');
    });
  }

  const hasErrors = results.errors.length > 0;
  const hasWarnings = results.warnings.length > 0;
  
  if (!hasErrors && !hasWarnings) {
    console.log('\n🎉 Migration completed successfully!');
  } else if (!hasErrors && hasWarnings) {
    console.log('\n⚠️  Migration completed with warnings - manual setup may be required');
  } else {
    console.log('\n❌ Migration completed with errors');
    process.exit(1);
  }
}

runMigration().catch(error => {
  console.error('💥 Migration failed:', error.message);
  process.exit(1);
});