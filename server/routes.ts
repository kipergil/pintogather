import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMapCollectionSchema, insertPinSchema } from "@shared/schema";
import { z } from "zod";
import { nanoid } from "nanoid";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Production-ready health endpoints with explicit JSON serialization
  const setupJsonResponse = (req: any, res: any, next: any) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  };

  // Apply JSON middleware to health endpoints
  app.use('/api/healthcheck', setupJsonResponse);
  app.use('/api/app-status', setupJsonResponse);
  app.use('/api/supabase-health', setupJsonResponse);

  // Health endpoints discovery
  app.get('/api/healthcheck', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const response = {
      timestamp: new Date().toISOString(),
      endpoints: {
        overall: `${baseUrl}/api/app-status`,
        supabase: `${baseUrl}/api/supabase-health`,
        discovery: `${baseUrl}/api/healthcheck`
      },
      description: "Public health monitoring endpoints for production deployment monitoring",
      usage: {
        monitoring: "Use these endpoints for external monitoring systems",
        loadBalancer: "Configure health checks using /api/app-status",
        debugging: "Use /api/supabase-health for database connectivity issues"
      }
    };
    
    res.status(200).end(JSON.stringify(response, null, 2));
  });

  // Overall application status
  app.get('/api/app-status', async (req, res) => {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        errors.push('Missing SUPABASE_URL environment variable');
      }
      
      if (!supabaseAnonKey) {
        errors.push('Missing SUPABASE_ANON_KEY environment variable');
      }

      let supabaseStatus = 'not_configured';
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          
          const { data, error } = await supabase.from('profiles').select('count').limit(1);
          
          if (error && !error.message.includes('relation "profiles" does not exist')) {
            errors.push(`Supabase connection error: ${error.message}`);
            supabaseStatus = 'error';
          } else {
            supabaseStatus = 'healthy';
          }
        } catch (err: any) {
          errors.push(`Supabase initialization error: ${err.message}`);
          supabaseStatus = 'error';
        }
      }

      const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'healthy';
      const httpStatus = errors.length > 0 ? 503 : 200;
      
      const response = {
        timestamp: new Date().toISOString(),
        status,
        services: {
          supabase: supabaseStatus,
          server: 'healthy'
        },
        errors,
        warnings
      };
      
      res.status(httpStatus).end(JSON.stringify(response, null, 2));
    } catch (error: any) {
      const errorResponse = {
        timestamp: new Date().toISOString(),
        status: 'error',
        errors: [`System error: ${error.message}`]
      };
      
      res.status(503).end(JSON.stringify(errorResponse, null, 2));
    }
  });

  // Supabase specific health check
  app.get('/api/supabase-health', async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      service: 'supabase',
      status: 'unknown',
      details: {
        configurationStatus: 'missing',
        connectionStatus: 'not_tested',
        authServiceStatus: 'not_tested',
        databaseStatus: 'not_tested'
      },
      errors: [] as string[]
    };

    if (!supabaseUrl || !supabaseAnonKey) {
      healthCheck.status = 'error';
      healthCheck.details.configurationStatus = 'missing';
      healthCheck.errors.push('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
      return res.status(503).end(JSON.stringify(healthCheck, null, 2));
    }

    healthCheck.details.configurationStatus = 'configured';

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        
        if (authError && authError.message !== 'Invalid JWT') {
          healthCheck.details.authServiceStatus = 'error';
          healthCheck.errors.push(`Auth service error: ${authError.message}`);
        } else {
          healthCheck.details.authServiceStatus = 'healthy';
        }
      } catch (authErr: any) {
        healthCheck.details.authServiceStatus = 'error';
        healthCheck.errors.push(`Auth test failed: ${authErr.message}`);
      }

      try {
        const { data: dbData, error: dbError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        if (dbError && !dbError.message.includes('relation "profiles" does not exist')) {
          healthCheck.details.databaseStatus = 'error';
          healthCheck.errors.push(`Database error: ${dbError.message}`);
        } else {
          healthCheck.details.databaseStatus = 'healthy';
        }
      } catch (dbErr: any) {
        healthCheck.details.databaseStatus = 'error';
        healthCheck.errors.push(`Database test failed: ${dbErr.message}`);
      }

      healthCheck.details.connectionStatus = 'connected';
      healthCheck.status = healthCheck.errors.length > 0 ? 'error' : 'healthy';
      
      const httpStatus = healthCheck.errors.length > 0 ? 503 : 200;
      res.status(httpStatus).end(JSON.stringify(healthCheck, null, 2));

    } catch (error: any) {
      healthCheck.status = 'error';
      healthCheck.details.connectionStatus = 'failed';
      healthCheck.errors.push(`Connection failed: ${error.message}`);
      
      res.status(503).end(JSON.stringify(healthCheck, null, 2));
    }
  });

  // Get Supabase configuration
  app.get("/api/config", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase configuration missing - authentication features will be limited');
      return res.status(503).json({
        error: 'Authentication service not configured',
        message: 'Missing Supabase configuration. Please check environment variables.',
        supabaseUrl: null,
        supabaseAnonKey: null,
        googleMapsApiKey: googleMapsApiKey || null
      });
    }
    
    res.json({
      supabaseUrl,
      supabaseAnonKey,
      googleMapsApiKey: googleMapsApiKey || null
    });
  });

  // Health check endpoint for Supabase connection (public access)
  app.get("/api/supabase-health", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      service: 'supabase',
      status: 'unknown',
      details: {
        configurationStatus: 'missing',
        connectionStatus: 'not_tested',
        authServiceStatus: 'not_tested',
        databaseStatus: 'not_tested'
      },
      errors: [] as string[]
    };

    // Check if environment variables are configured
    if (!supabaseUrl || !supabaseAnonKey) {
      healthCheck.status = 'error';
      healthCheck.details.configurationStatus = 'missing';
      healthCheck.errors.push('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
      return res.status(503).json(healthCheck);
    }

    healthCheck.details.configurationStatus = 'configured';

    try {
      // Import Supabase client dynamically to avoid issues if not configured
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Test basic connection by checking if we can reach the API
      const connectionStartTime = Date.now();
      
      try {
        // Test authentication service
        const { data: authData, error: authError } = await supabase.auth.getSession();
        const authResponseTime = Date.now() - connectionStartTime;
        
        if (authError && authError.message !== 'Invalid JWT') {
          healthCheck.details.authServiceStatus = 'error';
          healthCheck.errors.push(`Auth service error: ${authError.message}`);
        } else {
          healthCheck.details.authServiceStatus = 'healthy';
        }

        // Test database connection with a simple query
        const dbStartTime = Date.now();
        try {
          // Try to query the profiles table (this should exist if properly set up)
          const { data: dbData, error: dbError } = await supabase
            .from('profiles')
            .select('count')
            .limit(1)
            .single();
          
          const dbResponseTime = Date.now() - dbStartTime;
          
          if (dbError) {
            if (dbError.code === 'PGRST116') {
              // No rows returned - table exists but is empty, which is fine
              healthCheck.details.databaseStatus = 'healthy';
            } else if (dbError.code === '42P01') {
              // Table doesn't exist
              healthCheck.details.databaseStatus = 'warning';
              healthCheck.errors.push('Profiles table not found - database may need setup');
            } else {
              healthCheck.details.databaseStatus = 'error';
              healthCheck.errors.push(`Database error: ${dbError.message} (Code: ${dbError.code})`);
            }
          } else {
            healthCheck.details.databaseStatus = 'healthy';
          }
        } catch (dbTestError: any) {
          healthCheck.details.databaseStatus = 'error';
          healthCheck.errors.push(`Database connection failed: ${dbTestError.message}`);
        }

        healthCheck.details.connectionStatus = 'connected';
        
        // Overall status determination
        if (healthCheck.errors.length === 0) {
          healthCheck.status = 'healthy';
        } else if (healthCheck.details.authServiceStatus === 'healthy' && 
                   (healthCheck.details.databaseStatus === 'healthy' || healthCheck.details.databaseStatus === 'warning')) {
          healthCheck.status = 'warning';
        } else {
          healthCheck.status = 'error';
        }

      } catch (connectionError: any) {
        healthCheck.details.connectionStatus = 'failed';
        healthCheck.details.authServiceStatus = 'error';
        healthCheck.details.databaseStatus = 'error';
        healthCheck.status = 'error';
        healthCheck.errors.push(`Connection failed: ${connectionError.message}`);
      }

    } catch (importError: any) {
      healthCheck.status = 'error';
      healthCheck.details.connectionStatus = 'failed';
      healthCheck.errors.push(`Failed to initialize Supabase client: ${importError.message}`);
    }

    // Return appropriate HTTP status code
    const httpStatus = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'warning' ? 200 : 503;
    
    res.status(httpStatus).json(healthCheck);
  });

  // General application health check (public access)
  app.get("/api/app-status", async (req, res) => {
    const overallHealth = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      services: {
        application: {
          status: 'healthy',
          details: {
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'development',
            memoryUsage: process.memoryUsage(),
            pid: process.pid
          }
        },
        storage: {
          status: 'healthy',
          type: process.env.DATABASE_URL ? 'postgresql' : 'memory'
        },
        supabase: {
          status: 'unknown' as string,
          details: {} as any,
          errors: [] as string[]
        }
      },
      errors: [] as string[]
    };

    try {
      // Test storage connectivity
      await storage.getAllMapCollections();
      overallHealth.services.storage.status = 'healthy';
    } catch (error: any) {
      overallHealth.services.storage.status = 'error';
      overallHealth.errors.push(`Storage error: ${error.message}`);
    }

    // Get Supabase health status
    try {
      const supabaseHealthResponse = await fetch(`http://localhost:5000/api/supabase-health`);
      const supabaseHealth = await supabaseHealthResponse.json();
      
      overallHealth.services.supabase.status = supabaseHealth.status;
      overallHealth.services.supabase.details = supabaseHealth.details;
      overallHealth.services.supabase.errors = supabaseHealth.errors || [];

      if (supabaseHealth.errors && supabaseHealth.errors.length > 0) {
        overallHealth.errors.push(...supabaseHealth.errors);
      }
    } catch (error: any) {
      overallHealth.services.supabase.status = 'error';
      overallHealth.services.supabase.details = { configurationStatus: 'unknown' };
      overallHealth.services.supabase.errors = [`Failed to check Supabase health: ${error.message}`];
      overallHealth.errors.push(`Supabase health check failed: ${error.message}`);
    }

    // Determine overall status
    const serviceStatuses = Object.values(overallHealth.services).map(service => service.status);
    if (serviceStatuses.includes('error')) {
      overallHealth.status = 'error';
    } else if (serviceStatuses.includes('warning')) {
      overallHealth.status = 'warning';
    } else {
      overallHealth.status = 'healthy';
    }

    const httpStatus = overallHealth.status === 'healthy' ? 200 : 
                      overallHealth.status === 'warning' ? 200 : 503;
    
    res.status(httpStatus).json(overallHealth);
  });

  // Database migration endpoint - sets up Supabase tables
  app.post("/api/run-migration", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(503).json({
        error: 'Migration failed',
        message: 'Missing Supabase configuration or service role key'
      });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      const migrationResults = {
        timestamp: new Date().toISOString(),
        status: 'success',
        tables: [] as any[],
        errors: [] as string[]
      };

      // Create profiles table
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        if (profilesError && profilesError.code === '42P01') {
          // Table doesn't exist, try to create it via SQL
          const createProfilesSQL = `
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
          `;
          
          const { error: createError } = await supabase.rpc('exec_sql', { sql: createProfilesSQL });
          if (createError) {
            migrationResults.errors.push(`Failed to create profiles table: ${createError.message}`);
          } else {
            migrationResults.tables.push({ name: 'profiles', status: 'created' });
          }
        } else {
          migrationResults.tables.push({ name: 'profiles', status: 'exists' });
        }
      } catch (error: any) {
        migrationResults.errors.push(`Profiles table error: ${error.message}`);
      }

      // Create map_collections table
      try {
        const { data: mapsData, error: mapsError } = await supabase
          .from('map_collections')
          .select('count')
          .limit(1);
        
        if (mapsError && mapsError.code === '42P01') {
          const createMapsSQL = `
            CREATE TABLE IF NOT EXISTS map_collections (
              id VARCHAR(255) PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              description TEXT,
              share_url TEXT NOT NULL UNIQUE,
              owner_id VARCHAR(255),
              created_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
          `;
          
          const { error: createError } = await supabase.rpc('exec_sql', { sql: createMapsSQL });
          if (createError) {
            migrationResults.errors.push(`Failed to create map_collections table: ${createError.message}`);
          } else {
            migrationResults.tables.push({ name: 'map_collections', status: 'created' });
          }
        } else {
          migrationResults.tables.push({ name: 'map_collections', status: 'exists' });
        }
      } catch (error: any) {
        migrationResults.errors.push(`Map collections table error: ${error.message}`);
      }

      // Create pins table
      try {
        const { data: pinsData, error: pinsError } = await supabase
          .from('pins')
          .select('count')
          .limit(1);
        
        if (pinsError && pinsError.code === '42P01') {
          const createPinsSQL = `
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
          `;
          
          const { error: createError } = await supabase.rpc('exec_sql', { sql: createPinsSQL });
          if (createError) {
            migrationResults.errors.push(`Failed to create pins table: ${createError.message}`);
          } else {
            migrationResults.tables.push({ name: 'pins', status: 'created' });
          }
        } else {
          migrationResults.tables.push({ name: 'pins', status: 'exists' });
        }
      } catch (error: any) {
        migrationResults.errors.push(`Pins table error: ${error.message}`);
      }

      // Create map_viewers table
      try {
        const { data: viewersData, error: viewersError } = await supabase
          .from('map_viewers')
          .select('count')
          .limit(1);
        
        if (viewersError && viewersError.code === '42P01') {
          const createViewersSQL = `
            CREATE TABLE IF NOT EXISTS map_viewers (
              id VARCHAR(255) PRIMARY KEY,
              map_id VARCHAR(255) NOT NULL REFERENCES map_collections(id) ON DELETE CASCADE,
              user_id VARCHAR(255) NOT NULL,
              role TEXT NOT NULL DEFAULT 'viewer',
              created_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
          `;
          
          const { error: createError } = await supabase.rpc('exec_sql', { sql: createViewersSQL });
          if (createError) {
            migrationResults.errors.push(`Failed to create map_viewers table: ${createError.message}`);
          } else {
            migrationResults.tables.push({ name: 'map_viewers', status: 'created' });
          }
        } else {
          migrationResults.tables.push({ name: 'map_viewers', status: 'exists' });
        }
      } catch (error: any) {
        migrationResults.errors.push(`Map viewers table error: ${error.message}`);
      }

      // Determine overall status
      if (migrationResults.errors.length > 0) {
        migrationResults.status = migrationResults.tables.length > 0 ? 'partial' : 'failed';
      }

      const httpStatus = migrationResults.status === 'success' ? 200 :
                        migrationResults.status === 'partial' ? 200 : 500;

      res.status(httpStatus).json(migrationResults);

    } catch (error: any) {
      res.status(500).json({
        error: 'Migration failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get all map collections (filtered by user)
  app.get("/api/maps", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      
      // If no userId provided, return empty array (user not authenticated)
      if (!userId) {
        return res.json([]);
      }

      // Check if we want only owned maps, contributed maps, or all maps
      const ownedOnly = req.query.ownedOnly === 'true';
      const contributedOnly = req.query.contributedOnly === 'true';
      
      let maps;
      if (ownedOnly) {
        maps = await storage.getMapCollectionsByUserId(userId);
      } else if (contributedOnly) {
        maps = await storage.getContributedMaps(userId);
      } else {
        maps = await storage.getMapCollectionsForUser(userId);
      }
      const mapsWithPinCount = await Promise.all(
        maps.map(async (map) => {
          const pins = await storage.getPinsByMapId(map.id);
          return {
            ...map,
            pinCount: pins.length,
          };
        })
      );
      res.json(mapsWithPinCount);
    } catch (error: any) {
      console.error('Error fetching map collections:', error);
      res.status(500).json({ message: "Failed to fetch map collections", error: error.message });
    }
  });

  // Create new map collection
  app.post("/api/maps", async (req, res) => {
    try {
      const data = insertMapCollectionSchema.parse(req.body);
      
      // Check if map name already exists
      const existingMap = await storage.getMapCollectionByName(data.name);
      if (existingMap) {
        return res.status(400).json({ message: "A map collection with this name already exists" });
      }

      const mapCollection = await storage.createMapCollection(data);
      res.status(201).json(mapCollection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create map collection" });
      }
    }
  });

  // Update map sharing permissions
  app.put("/api/maps/:mapId/permissions", async (req, res) => {
    try {
      const { mapId } = req.params;
      const { isPublic, defaultPermission } = req.body;
      
      // Note: Add authentication check here when user system is implemented
      
      if (!['readonly', 'editable'].includes(defaultPermission)) {
        return res.status(400).json({ message: "Invalid permission type" });
      }

      const updatedMap = await storage.updateMapPermissions(mapId, isPublic, defaultPermission);
      if (!updatedMap) {
        return res.status(404).json({ message: "Map not found" });
      }

      res.json(updatedMap);
    } catch (error) {
      console.error('Error updating map permissions:', error);
      res.status(500).json({ message: "Failed to update map permissions" });
    }
  });

  // Delete map collection
  app.delete("/api/maps/:mapId", async (req, res) => {
    try {
      const { mapId } = req.params;
      const { userId } = req.body;
      
      console.log('Delete request received for mapId:', mapId, 'userId:', userId, 'body:', req.body);
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const deleted = await storage.deleteMapCollection(mapId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Map not found or you don't have permission to delete it" });
      }

      res.json({ message: "Map deleted successfully" });
    } catch (error) {
      console.error('Error deleting map:', error);
      res.status(500).json({ message: "Failed to delete map" });
    }
  });

  // Create map invitation
  app.post("/api/maps/:mapId/invitations", async (req, res) => {
    try {
      const { mapId } = req.params;
      const { email, permission } = req.body;
      
      if (!email || !permission) {
        return res.status(400).json({ message: "Email and permission are required" });
      }

      if (!['readonly', 'editable'].includes(permission)) {
        return res.status(400).json({ message: "Invalid permission type" });
      }

      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const invitationData = {
        mapId,
        email,
        permission,
        invitedBy: 'current-user', // Replace with actual user ID when auth is implemented
        token,
        expiresAt
      };

      const invitation = await storage.createInvitation(invitationData);
      
      // TODO: Send email notification here
      console.log(`Invitation created for ${email} with token: ${token}`);
      
      res.status(201).json(invitation);
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // Get map invitations
  app.get("/api/maps/:mapId/invitations", async (req, res) => {
    try {
      const { mapId } = req.params;
      
      // Note: Add ownership check here when user system is implemented
      
      const invitations = await storage.getMapInvitations(mapId);
      res.json(invitations);
    } catch (error) {
      console.error('Error fetching invitations:', error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation
  app.post("/api/invitations/:token/accept", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Update invitation status
      await storage.updateInvitationStatus(invitation.id, 'accepted');
      
      // Add user as map viewer (when user system is implemented)
      // const mapViewer = await storage.addMapViewer({
      //   mapId: invitation.mapId,
      //   userId: 'current-user-id',
      //   permission: invitation.permission
      // });

      res.json({ message: "Invitation accepted successfully" });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Delete invitation
  app.delete("/api/invitations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteInvitation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json({ message: "Invitation deleted successfully" });
    } catch (error) {
      console.error('Error deleting invitation:', error);
      res.status(500).json({ message: "Failed to delete invitation" });
    }
  });

  // Get map collection by share URL
  app.get("/api/maps/:shareUrl", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      
      if (!mapCollection) {
        return res.status(404).json({ message: "Map collection not found" });
      }

      const pins = await storage.getPinsByMapId(mapCollection.id);
      res.json({
        ...mapCollection,
        pins,
        pinCount: pins.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch map collection" });
    }
  });

  // Create new pin
  app.post("/api/maps/:shareUrl/pins", async (req, res) => {
    try {
      const { shareUrl } = req.params;
      const mapCollection = await storage.getMapCollectionByShareUrl(shareUrl);
      
      if (!mapCollection) {
        return res.status(404).json({ message: "Map collection not found" });
      }

      const data = insertPinSchema.parse({
        ...req.body,
        mapId: mapCollection.id,
      });

      const pin = await storage.createPin(data);
      res.status(201).json(pin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Pin validation error:', error.errors);
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        res.status(400).json({ 
          message: `Validation failed: ${errorMessages.join(', ')}`, 
          errors: error.errors 
        });
      } else {
        console.error('Pin creation error:', error);
        res.status(500).json({ message: "Failed to create pin" });
      }
    }
  });

  // Get a specific pin
  app.get("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const pin = await storage.getPinById(id);
      
      if (!pin) {
        return res.status(404).json({ message: "Pin not found" });
      }
      
      res.json(pin);
    } catch (error: any) {
      console.error('Error fetching pin:', error);
      res.status(500).json({ message: "Failed to fetch pin", error: error.message });
    }
  });

  // Update a pin
  app.put("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Validate the update data
      const validatedData = insertPinSchema.partial().parse(updateData);
      
      const updatedPin = await storage.updatePin(id, validatedData);
      if (!updatedPin) {
        return res.status(404).json({ message: "Pin not found or access denied" });
      }
      
      res.json(updatedPin);
    } catch (error: any) {
      console.error('Error updating pin:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update pin", error: error.message });
    }
  });

  // Delete pin
  app.delete("/api/pins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePin(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Pin not found" });
      }

      res.json({ message: "Pin deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pin" });
    }
  });

  // Reverse geocoding endpoint (using OpenStreetMap Nominatim)
  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CollabMap Application'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      
      if (!data || data.error) {
        return res.status(404).json({ message: "Location not found" });
      }

      const address = data.address || {};
      
      // Construct address without street names - use city/town, district/borough, state, country
      const addressParts = [];
      
      // Add city/town
      if (address.city) {
        addressParts.push(address.city);
      } else if (address.town || address.village) {
        addressParts.push(address.town || address.village);
      }
      
      // Add district/borough if different from city
      if (address.borough || address.suburb) {
        const districtName = address.borough || address.suburb;
        // Only add if it's different from the city/town already added
        if (!addressParts.includes(districtName)) {
          addressParts.push(districtName);
        }
      }
      
      // If no city/town but have borough/suburb, use that
      if (addressParts.length === 0 && (address.borough || address.suburb)) {
        addressParts.push(address.borough || address.suburb);
      }
      
      // Add state/region
      if (address.state || address.region) {
        addressParts.push(address.state || address.region);
      }
      
      // Add country
      if (address.country) {
        addressParts.push(address.country);
      }
      
      const cleanAddress = addressParts.join(', ') || `${lat}, ${lng}`;
      
      res.json({
        address: cleanAddress,
        city: address.city || '',
        town: address.town || address.village || '',
        state: address.state || address.region || '',
        borough: address.borough || address.suburb || '',
        postcode: address.postcode || '',
        country: address.country || '',
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch location data" });
    }
  });

  // Profile API route - get user profile by user ID
  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Admin API routes - only accessible to admin users
  app.get("/api/admin/users", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail || !(await storage.isAdmin(userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/group", async (req, res) => {
    try {
      const userEmail = req.headers['x-user-email'] as string;
      
      if (!userEmail || !(await storage.isAdmin(userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId } = req.params;
      const { userGroup } = req.body;

      if (!['freemium', 'basic', 'premium'].includes(userGroup)) {
        return res.status(400).json({ message: "Invalid user group" });
      }

      const updatedUser = await storage.updateUserGroup(userId, userGroup);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user group:', error);
      res.status(500).json({ message: "Failed to update user group" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
