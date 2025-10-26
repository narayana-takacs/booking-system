# Production Deployment Guide

This guide walks through deploying the n8n booking automation system to a production environment.

**IMPORTANT**: This entire system runs in Docker containers. You only need Docker and Docker Compose installed on your server - no other dependencies required!

## Prerequisites

### Required
- Server with Docker installed (any OS: Linux, Windows Server, macOS):
  - Minimum 2 GB RAM, 2 CPU cores
  - 10 GB disk space
  - Docker Engine 20.10+ and Docker Compose 2.0+
  - Public IP address (or accessible via ngrok/Cloudflare Tunnel for testing)
- Domain name with DNS access (optional for local testing)
- Airtable account with API access
- SMTP email provider credentials (or use included Mailpit for testing)

### Recommended for Production
- SSL/TLS termination (via reverse proxy or Cloudflare)
- Password manager for storing credentials
- Firewall configured
- Automated backups

## Pre-Deployment Checklist

- [ ] Server provisioned and accessible via SSH
- [ ] Domain DNS configured (A record pointing to server IP)
- [ ] Docker and Docker Compose installed
- [ ] Ports 80 and 443 open in firewall
- [ ] Production credentials generated (use `node scripts/generate-secrets.js`)
- [ ] Airtable base created with three tables
- [ ] SMTP provider account created
- [ ] SSL certificate obtained (or ready to generate)

## Deployment Overview

The system consists of **3 Docker containers** defined in `infra/docker-compose.yml`:

1. **n8n** (port 5678) - Workflow automation engine
2. **postgres** (internal only) - Database for n8n
3. **mailpit** (ports 1025, 8025) - SMTP server for development/testing

All you need to do is:
1. Clone the repository
2. Configure environment variables in `.env` file
3. Run `docker compose up -d`

That's it! No complex installation or dependencies.

## Step 1: Install Docker (if not already installed)

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes
```

### Windows
Download Docker Desktop from https://www.docker.com/products/docker-desktop

### macOS
Download Docker Desktop from https://www.docker.com/products/docker-desktop

Verify installation:
```bash
docker --version
docker compose version
```

## Step 2: Clone Repository

```bash
# Create directory and clone
mkdir booking-system
cd booking-system
git clone https://github.com/narayana-takacs/booking-system.git .
```

## Step 3: Configure Environment Variables

### 3.1 Generate Secure Credentials

```bash
node scripts/generate-secrets.js
```

**IMPORTANT**: Copy and save the output to your password manager! You'll need these values in the next step.

### 3.2 Create .env File

```bash
cp infra/.env.production.template infra/.env
# Or on Windows: copy infra\.env.production.template infra\.env
```

### 3.3 Edit .env File

Open `infra/.env` in your preferred text editor and update:

#### Required Changes
1. `N8N_ENCRYPTION_KEY` - Use generated value
2. `N8N_BASIC_AUTH_PASSWORD` - Use generated value
3. `N8N_HOST` - Your domain (e.g., `booking.yourdomain.com`)
4. `WEBHOOK_URL` - `https://booking.yourdomain.com/`
5. `POSTGRES_PASSWORD` - Use generated value
6. `AIRTABLE_PAT` - Your Airtable Personal Access Token
7. `AIRTABLE_BASE_ID` - Your Airtable base ID (starts with `app`)
8. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` - Your SMTP provider
9. `PROVIDER_ALERT_EMAIL` - Your email for booking notifications

#### Optional Changes
- `GENERIC_TIMEZONE` - Set to your local timezone (default: `America/New_York`)
- `N8N_BASIC_AUTH_USER` - Change from `admin` if desired
- `WEBHOOK_API_KEY` - Uncomment and use generated value for webhook security

Save and exit (Ctrl+X, Y, Enter).

## Step 4: Start Docker Containers

This is the magic step - just one command!

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

**What this does:**
- Downloads the n8n, Postgres, and Mailpit Docker images
- Creates volumes for persistent data storage
- Starts all three containers in the background
- n8n will be accessible on port 5678

### Verify Containers Are Running

```bash
docker compose -f infra/docker-compose.yml ps
```

You should see all three containers with STATUS "Up":
```
NAME                          IMAGE                  STATUS
booking-system-n8n-1          n8nio/n8n:latest       Up X seconds
booking-system-n8n-postgres-1 postgres:16-alpine     Up X seconds
booking-system-mailpit-1      axllent/mailpit:latest Up X seconds
```

### Check Logs (Optional)

```bash
docker compose -f infra/docker-compose.yml logs -f n8n
```

Look for `Server started on port 5678`. Press Ctrl+C to exit.

## Step 5: Access n8n and Complete Setup

### 5.1 Access n8n UI

Open your browser and navigate to:
- **Local testing**: `http://localhost:5678`
- **Production with domain**: `https://your-domain.com` (requires SSL setup - see below)
- **Production without SSL**: `http://your-server-ip:5678`

### 5.2 Login with Basic Auth

When prompted, enter:
- **Username**: Value of `N8N_BASIC_AUTH_USER` from your `.env` (default: `admin`)
- **Password**: Value of `N8N_BASIC_AUTH_PASSWORD` from your `.env`

### 5.3 Create Owner Account

n8n will prompt you to create an owner account:
- **Email**: Your admin email
- **Password**: Strong password (different from basic auth!)
- **First name / Last name**: Your details

**IMPORTANT**: Save these owner credentials to your password manager!

### 5.4 Import Workflow

**Option A: Via Docker Command**

```bash
docker exec -i $(docker compose -f infra/docker-compose.yml ps -q n8n) \
  n8n import:workflow --input=/dev/stdin < workflows/booking_airtable.json
```

**Option B: Via UI (Easier)**

1. Click "Workflows" in the left sidebar
2. Click "+ Add workflow" button
3. Click the three-dot menu (⋮) in top right
4. Select "Import from file"
5. Upload `workflows/booking_airtable.json` from your local copy

### 5.5 Activate Workflow

1. Open the "Squarespace Booking Automation" workflow
2. Click the "Inactive" toggle in top right corner (turns green when active)
3. Note the webhook URL displayed: `http://your-server:5678/webhook/booking-request`

## Step 7: Test the System

### 7.1 Test Webhook Endpoint

From your local machine:

```bash
curl -X POST https://booking.yourdomain.com/webhook/booking-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "bookingReason": "Production test",
    "requestedStart": "2025-11-01T14:00:00Z",
    "requestedEnd": "2025-11-01T14:30:00Z"
  }'
```

Expected response (if using real Airtable):
```json
{
  "status": "pending",
  "message": "Request submitted and awaiting provider review.",
  "clientStatus": "unknown",
  ...
}
```

### 7.2 Check n8n Execution

1. In n8n UI, click "Executions" in sidebar
2. Find the most recent execution
3. Click to view details
4. Verify all nodes executed successfully (green checkmarks)

### 7.3 Verify Airtable Updates

1. Open your Airtable base
2. Check Clients table - should have new "Test User" record with Status "Unknown"
3. Check Bookings table - should have new booking with Status "Pending Review"

### 7.4 Check Email Delivery

Check the email inbox for `PROVIDER_ALERT_EMAIL` - you should receive a "Booking request pending review" email.

**Note**: If using Mailpit in production (not recommended), access http://your-server-ip:8025 to see captured emails.

## Step 8: Security Hardening

### 8.1 Add Webhook API Key Validation

See `docs/WEBHOOK_SECURITY.md` for implementation guide (create if needed).

### 8.2 Configure Rate Limiting

Add to your Nginx configuration inside the `server` block:

```nginx
limit_req_zone $binary_remote_addr zone=webhook_limit:10m rate=10r/m;

location /webhook/ {
    limit_req zone=webhook_limit burst=5 nodelay;
    proxy_pass http://127.0.0.1:5678;
    # ... rest of proxy settings
}
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

### 8.3 Rotate Default Credentials

If you haven't already, ensure you've changed:
- [x] `N8N_BASIC_AUTH_PASSWORD` (from default)
- [x] `POSTGRES_PASSWORD` (from default)
- [x] n8n owner account password (created during setup)

### 8.4 Set Up Automated Backups

#### Database Backup Script

```bash
nano ~/backup-n8n.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR=~/n8n-backups
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

docker exec $(docker compose -f ~/booking-system/infra/docker-compose.yml ps -q n8n-postgres) \
  pg_dump -U n8n n8n | gzip > $BACKUP_DIR/n8n_backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "n8n_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: n8n_backup_$DATE.sql.gz"
```

Make executable and add to crontab:

```bash
chmod +x ~/backup-n8n.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/user/backup-n8n.sh >> /home/user/backup.log 2>&1
```

## Step 9: Monitoring Setup

### 9.1 Basic Health Check

Create a simple monitoring script:

```bash
nano ~/check-n8n-health.sh
```

```bash
#!/bin/bash
WEBHOOK_URL="https://booking.yourdomain.com/webhook/booking-request"
ALERT_EMAIL="admin@yourdomain.com"

# Check if webhook responds
if ! curl -f -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" \
  -d '{"name":"Health Check"}' > /dev/null 2>&1; then
  echo "n8n webhook is DOWN!" | mail -s "n8n Alert" "$ALERT_EMAIL"
fi
```

Add to crontab (every 15 minutes):
```bash
*/15 * * * * /home/user/check-n8n-health.sh
```

### 9.2 Log Monitoring

View recent errors:
```bash
docker compose -f ~/booking-system/infra/docker-compose.yml logs --tail=100 n8n | grep -i error
```

## Troubleshooting

### Issue: Cannot connect to n8n UI

**Check**:
1. Nginx is running: `sudo systemctl status nginx`
2. n8n container is running: `docker compose -f infra/docker-compose.yml ps`
3. Firewall allows port 443: `sudo ufw status`
4. DNS resolves correctly: `nslookup booking.yourdomain.com`

### Issue: Webhook returns 500 error

**Check**:
1. n8n logs: `docker compose -f infra/docker-compose.yml logs n8n`
2. Workflow is activated in n8n UI
3. Airtable credentials are correct (test in n8n credential manager)
4. Environment variables loaded correctly: `docker exec booking-system-n8n-1 env | grep AIRTABLE`

### Issue: Emails not sending

**Check**:
1. SMTP settings in `.env` are correct
2. Test SMTP connection: `docker exec booking-system-n8n-1 nc -zv $SMTP_HOST $SMTP_PORT`
3. Check email provider logs/dashboard for rejections
4. Verify `PROVIDER_ALERT_EMAIL` is valid

### Issue: Airtable API errors

**Check**:
1. Personal Access Token has correct scopes (data.records:read, data.records:write)
2. Base ID is correct (starts with `app`)
3. Table names match exactly (case-sensitive)
4. API rate limits not exceeded (5 req/sec per base)

## Post-Deployment Tasks

- [ ] Test all booking scenarios (Active client, Inactive, Unknown, invalid slots)
- [ ] Verify .ics calendar attachments work in Gmail, Outlook, Apple Mail
- [ ] Set up monitoring alerts
- [ ] Document recovery procedures
- [ ] Schedule first backup verification
- [ ] Create runbook for common operational tasks
- [ ] Set calendar reminder to rotate credentials in 90 days

## Maintenance

### Update n8n Version

```bash
cd ~/booking-system
docker compose -f infra/docker-compose.yml pull n8n
docker compose -f infra/docker-compose.yml up -d n8n
docker compose -f infra/docker-compose.yml logs -f n8n
```

### Restart Services

```bash
docker compose -f infra/docker-compose.yml restart
```

### View Logs

```bash
# All services
docker compose -f infra/docker-compose.yml logs -f

# Specific service
docker compose -f infra/docker-compose.yml logs -f n8n
```

### Database Access

```bash
docker exec -it $(docker compose -f ~/booking-system/infra/docker-compose.yml ps -q n8n-postgres) \
  psql -U n8n -d n8n
```

## Next Steps

After successful deployment:
1. Proceed to Squarespace frontend integration (see STATUS.md Phase 4)
2. Implement availability endpoint for dynamic slot selection
3. Consider implementing webhook API key validation
4. Set up comprehensive monitoring (Uptime Robot, Pingdom, etc.)

## Support

For issues:
1. Check troubleshooting section above
2. Review n8n logs for error messages
3. Consult CLAUDE.md for architecture details
4. Open issue at https://github.com/narayana-takacs/booking-system/issues
