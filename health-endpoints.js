// Standalone health endpoints with explicit JSON handling for production
const express = require('express');

function setupHealthEndpoints(app) {
  // Middleware to ensure JSON responses
  const jsonMiddleware = (req, res, next) => {
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

  // Apply middleware to all health endpoints
  app.use('/api/healthcheck', jsonMiddleware);
  app.use('/api/app-status', jsonMiddleware);
  app.use('/api/supabase-health', jsonMiddleware);

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
      const errors = [];
      const warnings = [];
      
      // Check environment variables
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl) {
        errors.push('Missing SUPABASE_URL environment variable');
      }
      
      if (!supabaseAnonKey) {
        errors.push('Missing SUPABASE_ANON_KEY environment variable');
      }

      // Test Supabase if configured
      let supabaseStatus = 'not_configured';
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const { createClient } = require('@supabase/supabase-js');
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          
          const { data, error } = await supabase.from('profiles').select('count').limit(1);
          
          if (error && !error.message.includes('relation "profiles" does not exist')) {
            errors.push(`Supabase connection error: ${error.message}`);
            supabaseStatus = 'error';
          } else {
            supabaseStatus = 'healthy';
          }
        } catch (err) {
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
    } catch (error) {
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
      errors: []
    };

    // Check configuration
    if (!supabaseUrl || !supabaseAnonKey) {
      healthCheck.status = 'error';
      healthCheck.details.configurationStatus = 'missing';
      healthCheck.errors.push('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
      return res.status(503).end(JSON.stringify(healthCheck, null, 2));
    }

    healthCheck.details.configurationStatus = 'configured';

    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Test auth service
      try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        
        if (authError && authError.message !== 'Invalid JWT') {
          healthCheck.details.authServiceStatus = 'error';
          healthCheck.errors.push(`Auth service error: ${authError.message}`);
        } else {
          healthCheck.details.authServiceStatus = 'healthy';
        }
      } catch (authErr) {
        healthCheck.details.authServiceStatus = 'error';
        healthCheck.errors.push(`Auth test failed: ${authErr.message}`);
      }

      // Test database
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
      } catch (dbErr) {
        healthCheck.details.databaseStatus = 'error';
        healthCheck.errors.push(`Database test failed: ${dbErr.message}`);
      }

      healthCheck.details.connectionStatus = 'connected';
      healthCheck.status = healthCheck.errors.length > 0 ? 'error' : 'healthy';
      
      const httpStatus = healthCheck.errors.length > 0 ? 503 : 200;
      res.status(httpStatus).end(JSON.stringify(healthCheck, null, 2));

    } catch (error) {
      healthCheck.status = 'error';
      healthCheck.details.connectionStatus = 'failed';
      healthCheck.errors.push(`Connection failed: ${error.message}`);
      
      res.status(503).end(JSON.stringify(healthCheck, null, 2));
    }
  });
}

module.exports = { setupHealthEndpoints };