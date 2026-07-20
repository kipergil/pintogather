# Production Health Monitoring Endpoints

## Overview
The application exposes public health monitoring endpoints for production deployment and external monitoring systems.

## Available Endpoints

### 1. Health Check Discovery
**URL:** `/api/healthcheck`
**Method:** GET
**Purpose:** Lists all available health monitoring endpoints
**Public Access:** Yes

```bash
curl https://your-app.example.com/api/healthcheck
```

### 2. Overall Application Status
**URL:** `/api/app-status`
**Method:** GET
**Purpose:** Complete application health, including Directus connectivity
**Public Access:** Yes
**Use Cases:**
- Load balancer health checks
- External monitoring systems
- Deployment verification

```bash
curl https://your-app.example.com/api/app-status
```

### 3. Directus Connectivity
**URL:** `/api/directus-health`
**Method:** GET
**Purpose:** Verifies the server can reach Directus with its configured service token
**Public Access:** Yes
**Use Cases:**
- Database/Directus connectivity debugging
- Service-specific monitoring

```bash
curl https://your-app.example.com/api/directus-health
```

## Response Formats

### Healthy Status Example
```json
{
  "status": "healthy",
  "directusUrl": "https://your-directus-instance.example.com",
  "timestamp": "2026-07-20T21:12:17.040Z"
}
```

### Error Status Example
```json
{
  "status": "error",
  "errors": [
    "Missing DIRECTUS_URL or DIRECTUS_SERVICE_TOKEN environment variables"
  ]
}
```

## HTTP Status Codes
- **200**: Service healthy
- **503**: Service unavailable or critical errors

## Monitoring Setup

### External Monitoring Systems
Configure your monitoring tools to check:
- **Primary:** `/api/app-status` (overall health)
- **Secondary:** `/api/directus-health` (Directus-specific issues)

### Load Balancer Configuration
Use `/api/app-status` for health checks with:
- Check interval: 30 seconds
- Timeout: 10 seconds
- Healthy threshold: 2 consecutive successes
- Unhealthy threshold: 3 consecutive failures

## Security Notes

- Health endpoints are public by design for monitoring
- No sensitive data (tokens, credentials) is exposed in responses
- Only status information is provided

## Troubleshooting

### Common Issues
1. **503 Errors**: Check `DIRECTUS_URL` and `DIRECTUS_SERVICE_TOKEN` are set correctly
2. **Timeout**: Directus instance unreachable or overloaded

### Debug Steps
1. Check `/api/healthcheck` for endpoint availability
2. Review `/api/directus-health` for Directus-specific issues
3. Examine `/api/app-status` for overall system status
4. Verify environment variables in the deployment platform
