-- Supabase Database Migration SQL
-- Run this script in your Supabase SQL Editor to create the required tables

-- Create profiles table
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

-- Create map_collections table
CREATE TABLE IF NOT EXISTS map_collections (
  id VARCHAR(255) PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  share_url TEXT NOT NULL UNIQUE,
  owner_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create map_viewers table
CREATE TABLE IF NOT EXISTS map_viewers (
  id VARCHAR(255) PRIMARY KEY,
  map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create pins table
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_map_collections_owner_id ON map_collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_map_collections_share_url ON map_collections(share_url);
CREATE INDEX IF NOT EXISTS idx_map_viewers_map_id ON map_viewers(map_id);
CREATE INDEX IF NOT EXISTS idx_map_viewers_user_id ON map_viewers(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_map_id ON pins(map_id);
CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);

-- Enable Row Level Security (RLS) for better security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Create RLS policies for map_collections table
CREATE POLICY "Users can view maps they own or have access to" ON map_collections
  FOR SELECT USING (
    owner_id = auth.uid()::text OR 
    id IN (SELECT map_id FROM map_viewers WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can create their own maps" ON map_collections
  FOR INSERT WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their own maps" ON map_collections
  FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can delete their own maps" ON map_collections
  FOR DELETE USING (owner_id = auth.uid()::text);

-- Create RLS policies for map_viewers table
CREATE POLICY "Map owners can manage viewers" ON map_viewers
  FOR ALL USING (
    map_id IN (SELECT id FROM map_collections WHERE owner_id = auth.uid()::text)
  );

CREATE POLICY "Users can view their own access" ON map_viewers
  FOR SELECT USING (user_id = auth.uid()::text);

-- Create RLS policies for pins table
CREATE POLICY "Users can view pins on accessible maps" ON pins
  FOR SELECT USING (
    map_id IN (
      SELECT id FROM map_collections 
      WHERE owner_id = auth.uid()::text OR 
      id IN (SELECT map_id FROM map_viewers WHERE user_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can create pins on accessible maps" ON pins
  FOR INSERT WITH CHECK (
    map_id IN (
      SELECT id FROM map_collections 
      WHERE owner_id = auth.uid()::text OR 
      id IN (SELECT map_id FROM map_viewers WHERE user_id = auth.uid()::text AND role IN ('contributor', 'editor'))
    )
  );

CREATE POLICY "Users can update their own pins or as map owner" ON pins
  FOR UPDATE USING (
    user_id = auth.uid()::text OR
    map_id IN (SELECT id FROM map_collections WHERE owner_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete their own pins or as map owner" ON pins
  FOR DELETE USING (
    user_id = auth.uid()::text OR
    map_id IN (SELECT id FROM map_collections WHERE owner_id = auth.uid()::text)
  );

-- Grant necessary permissions to authenticated users
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON map_collections TO authenticated;
GRANT ALL ON map_viewers TO authenticated;
GRANT ALL ON pins TO authenticated;

-- Grant select permissions to anonymous users for public maps (if needed)
GRANT SELECT ON map_collections TO anon;
GRANT SELECT ON pins TO anon;