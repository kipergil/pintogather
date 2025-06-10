-- SUPABASE MANUAL MIGRATION SCRIPT
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- Step 1: Create missing tables (profiles and map_collections may already exist)
CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  twitter_handle TEXT,
  instagram_handle TEXT,
  linkedin_handle TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS map_collections (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  share_url TEXT NOT NULL UNIQUE,
  owner_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS map_viewers (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

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

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_map_collections_owner_id ON map_collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_map_collections_share_url ON map_collections(share_url);
CREATE INDEX IF NOT EXISTS idx_map_viewers_map_id ON map_viewers(map_id);
CREATE INDEX IF NOT EXISTS idx_map_viewers_user_id ON map_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_map_id ON pins(map_id);
CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);

-- Step 3: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Step 4: Create basic RLS policies for authenticated users
CREATE POLICY "Allow authenticated users full access to profiles" ON profiles
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to map_collections" ON map_collections
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to map_viewers" ON map_viewers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users full access to pins" ON pins
  FOR ALL USING (auth.role() = 'authenticated');

-- Step 5: Grant permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON map_collections TO authenticated;
GRANT ALL ON map_viewers TO authenticated;
GRANT ALL ON pins TO authenticated;

-- Allow anonymous users to read public maps if needed
GRANT SELECT ON map_collections TO anon;
GRANT SELECT ON pins TO anon;