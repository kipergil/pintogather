# Production Health Monitoring Endpoints

## Overview
Your application now includes comprehensive public health monitoring endpoints designed for production deployment and external monitoring systems.

## Available Endpoints

### 1. Health Check Discovery
**URL:** `/api/healthcheck`
**Method:** GET
**Purpose:** Lists all available health monitoring endpoints
**Public Access:** Yes
**CORS:** Enabled

```bash
curl https://your-app.replit.app/api/healthcheck
```

### 2. Overall Application Status
**URL:** `/api/app-status`
**Method:** GET
**Purpose:** Complete application health including all services
**Public Access:** Yes
**CORS:** Enabled
**Use Cases:**
- Load balancer health checks
- External monitoring systems
- Deployment verification

```bash
curl https://your-app.replit.app/api/app-status
```

### 3. Supabase Service Health
**URL:** `/api/supabase-health`
**Method:** GET
**Purpose:** Detailed Supabase connectivity and database status
**Public Access:** Yes
**CORS:** Enabled
**Use Cases:**
- Database connectivity debugging
- Service-specific monitoring
- Troubleshooting authentication issues

```bash
curl https://your-app.replit.app/api/supabase-health
```

## Response Formats

### Healthy Status Example
```json
{
  "timestamp": "2025-06-10T21:12:17.040Z",
  "service": "supabase",
  "status": "healthy",
  "details": {
    "configurationStatus": "configured",
    "connectionStatus": "connected",
    "authServiceStatus": "healthy",
    "databaseStatus": "healthy"
  },
  "errors": []
}
```

### Error Status Example
```json
{
  "timestamp": "2025-06-10T21:12:17.040Z",
  "status": "error",
  "errors": [
    "Missing SUPABASE_URL environment variable",
    "Database connection failed"
  ]
}
```

## Production Configuration

### CORS Headers
All health endpoints include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Cache-Control: no-cache, no-store, must-revalidate`

### HTTP Status Codes
- **200**: Service healthy or healthy with warnings
- **503**: Service unavailable or critical errors

## Monitoring Setup

### External Monitoring Systems
Configure your monitoring tools to check:
- **Primary:** `/api/app-status` (overall health)
- **Secondary:** `/api/supabase-health` (database-specific issues)

### Load Balancer Configuration
Use `/api/app-status` for health checks with:
- Check interval: 30 seconds
- Timeout: 10 seconds
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 3 consecutive failures

### Alerting Rules
- **Critical:** `status === "error"` 
- **Warning:** `status === "warning"`
- **Monitor:** Response time > 5 seconds

## Deployment Verification

After deployment, verify all endpoints:

```bash
# Check discovery endpoint
curl https://your-app.replit.app/api/healthcheck

# Verify overall health
curl https://your-app.replit.app/api/app-status

# Check database connectivity
curl https://your-app.replit.app/api/supabase-health
```

## Security Notes

- Health endpoints are public by design for monitoring
- No sensitive data is exposed in responses
- Environment variables are not leaked
- Database credentials remain secure
- Only status information is provided

## Troubleshooting

### Common Issues
1. **503 Errors**: Check environment variables are set
2. **Timeout**: Database connection issues
3. **CORS Errors**: Endpoints support preflight requests

### Debug Steps
1. Check `/api/healthcheck` for endpoint availability
2. Review `/api/supabase-health` for database issues
3. Examine `/api/app-status` for overall system status
4. Verify environment variables in deployment platform