# Environment Configuration Guide

This document explains how to configure environment variables for the EagleChair application.

## Environment Files

The application supports multiple environment files with the following priority order (highest to lowest):

1. **`.env.local`** - Local overrides (not committed to git)
2. **`.env.{ENVIRONMENT}`** - Environment-specific files (committed to git)
3. **`.env`** - Fallback file (committed to git)

## Available Environment Files

### `.env.development`
- Used for local development
- Contains development database URL: `postgresql://postgres:postgres@postgres:5432/eaglechair`
- Debug mode enabled
- Verbose logging

### `.env.staging`
- Used for staging environment
- Contains staging-specific configurations
- Moderate security settings
- Production-like but with test payment keys

### `.env.production`
- Used for production environment
- Contains production database URL
- Strict security settings
- Live payment keys

### `.env.local`
- For local development overrides
- Not committed to git
- Copy values from `.env.development` and modify as needed

## Setting the Environment

The application automatically loads the appropriate environment file based on the `ENVIRONMENT` variable:

```bash
# Development (default)
export ENVIRONMENT=development

# Staging
export ENVIRONMENT=staging

# Production
export ENVIRONMENT=production
```

## Database Configuration

### Development
```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/eaglechair
```

### Staging
```bash
DATABASE_URL=postgresql://eaglechair_user:your_staging_password@your-staging-db-host:5432/eaglechair_staging
```

### Production
```bash
DATABASE_URL=postgresql://eaglechair_user:your_production_password@your-production-db-host:5432/eaglechair_prod
```

## Key Configuration Variables

| Variable | Description | Development | Staging | Production |
|----------|-------------|-------------|---------|------------|
| `DEBUG` | Enable debug mode | `True` | `False` | `False` |
| `LOG_LEVEL` | Logging level | `DEBUG` | `INFO` | `INFO` |
| `SECRET_KEY` | JWT secret key | Dev key | Staging key | Production key |
| `RATE_LIMIT_PER_MINUTE` | API rate limit | 100 | 80 | 60 |
| `HTTPS_REDIRECT` | Force HTTPS | `False` | `True` | `True` |
| `DATABASE_ECHO` | Log SQL queries | `True` | `False` | `False` |

## Security Considerations

1. **Never commit sensitive data** to git
2. **Use strong secret keys** in production
3. **Enable HTTPS redirect** in staging and production
4. **Use environment-specific database credentials**
5. **Configure proper CORS origins** for each environment

## Local Development Setup

1. Copy `.env.development` to `.env.local`
2. Modify `.env.local` with your local overrides
3. Set `ENVIRONMENT=development` (or leave unset)
4. Run the application

## Production Deployment

1. Set `ENVIRONMENT=production`
2. Ensure `.env.production` contains correct production values
3. Verify all sensitive data is properly configured
4. Test database connectivity
5. Verify HTTPS and security settings

## Troubleshooting

### Environment file not loading
- Check that the file exists in the project root
- Verify the `ENVIRONMENT` variable is set correctly
- Check file permissions

### Database connection issues
- Verify the database URL format
- Check database server accessibility
- Ensure database credentials are correct

### Configuration not applying
- Check the priority order of environment files
- Verify variable names match exactly
- Check for typos in variable names
