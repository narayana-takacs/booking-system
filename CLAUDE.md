# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an n8n-based booking automation system that integrates with Squarespace forms and Airtable. The system validates booking requests against provider availability, checks client status, and automatically accepts or flags bookings for manual review.

## Core Architecture

### System Components

- **n8n Workflow Engine**: Orchestrates the booking logic via webhook-triggered workflows
- **Airtable Data Store**: Three tables manage the system state:
  - Clients table: Client registry with status tracking (Active/Inactive/Unknown)
  - Availability table: Provider working hours and available time slots
  - Bookings table: Source of truth for all booking requests and decisions
- **Mailpit**: Local SMTP server for testing email notifications during development
- **PostgreSQL**: Persists n8n execution history, workflow state, and credentials

### Workflow Logic Flow

1. Webhook receives booking request from Squarespace form
2. Configuration node loads environment variables
3. Process Booking node (JavaScript):
   - Validates payload fields
   - Queries Airtable to find/create client record
   - Fetches availability and existing bookings
   - Determines if slot is valid and available
   - Auto-accepts for Active clients, flags others for review
   - Generates .ics calendar attachment for accepted bookings
4. Conditional routing sends emails based on booking status
5. Webhook responds with structured JSON

The core booking logic lives in `workflows/workflow_code.js` (lines 1-225), which is embedded into the n8n workflow JSON by `workflows/generate_workflow.js`.

## Development Commands

### Infrastructure

Start the Docker stack (n8n + Postgres + Mailpit):
```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

View n8n execution logs:
```bash
docker compose -f infra/docker-compose.yml logs -f n8n
```

Stop and reset environment (destroys data):
```bash
docker compose -f infra/docker-compose.yml down -v
```

### Workflow Development

Generate workflow JSON from code:
```bash
node workflows/generate_workflow.js
```

This reads `workflows/workflow_code.js` and outputs `workflows/booking_airtable.json`.

Import workflow into n8n:
```bash
docker exec -i $(docker compose -f infra/docker-compose.yml ps -q n8n) n8n import:workflow --input=/dev/stdin < workflows/booking_airtable.json
```

### Database Inspection

Connect to Postgres for debugging:
```bash
docker exec -it $(docker compose -f infra/docker-compose.yml ps -q n8n-postgres) psql -U n8n -d n8n
```

Query execution history:
```bash
docker exec -i $(docker compose -f infra/docker-compose.yml ps -q n8n-postgres) psql -U n8n -d n8n -f infra/query_executions.sql
```

Helper SQL scripts in `infra/` include:
- `query_workflows.sql`: List all imported workflows
- `query_webhooks.sql`: Show webhook configurations
- `query_execution_payload.sql`: Inspect input/output data

### Testing

Test booking endpoint with stub mode (bypasses Airtable):
```bash
curl -X POST http://127.0.0.1:5678/webhook/booking-request \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "email": "test@example.com",
    "bookingReason": "Testing",
    "requestedStart": "2025-10-20T14:00:00Z",
    "requestedEnd": "2025-10-20T14:30:00Z",
    "stubClientStatus": "Active"
  }'
```

Set `AIRTABLE_USE_STUB=true` in `infra/.env` to enable stub mode for local testing without Airtable credentials.

Check Mailpit for sent emails:
```
http://localhost:8025
```

## Configuration

All secrets and configuration live in `infra/.env` (use `infra/.env.example` as template).

Required environment variables:
- `N8N_ENCRYPTION_KEY`: Encryption key for n8n credentials vault
- `N8N_BASIC_AUTH_USER` / `N8N_BASIC_AUTH_PASSWORD`: n8n UI authentication
- `POSTGRES_PASSWORD`: Database password
- `WEBHOOK_URL`: Public webhook base URL (production only)
- `AIRTABLE_PAT`: Personal Access Token for Airtable API
- `AIRTABLE_BASE_ID`: Base ID containing the three tables
- `PROVIDER_ALERT_EMAIL`: Email address for booking notifications

## Key Files

- `workflows/workflow_code.js`: Main booking validation and decision logic
- `workflows/generate_workflow.js`: Builds n8n workflow JSON from code
- `workflows/booking_airtable.json`: Generated n8n workflow definition
- `infra/docker-compose.yml`: Docker stack orchestration
- `docs/PROJECT_OVERVIEW.md`: Detailed system design and acceptance criteria
- `AGENTS.md`: Development guidelines and conventions

## Workflow Node References

When debugging n8n executions, these are the key nodes:
- `Receive Booking Request`: Webhook trigger on `/webhook/booking-request`
- `Process Booking`: Core JavaScript logic (workflow_code.js:1-225)
- `Is Accepted`: Routes accepted bookings to confirmation email
- `Needs Review`: Routes pending bookings to provider alert
- `Send Client Confirmation`: Emails .ics attachment to accepted clients
- `Send Provider Alert`: Notifies provider of pending/accepted bookings
- `Respond to Webhook`: Returns JSON response to Squarespace form

## Booking Status Decisions

The system returns one of three statuses:

1. **accepted**: Client status is "Active", slot is available and valid
   - Creates Airtable booking with Status="Accepted"
   - Sends confirmation email with .ics attachment
   - Returns success to form

2. **pending**: Client status is "Inactive" or "Unknown", slot is valid
   - Creates Airtable booking with Status="Pending Review"
   - Sends alert to provider
   - Returns pending message to form

3. **unavailable**: Slot fails validation (out of hours or overlaps existing booking)
   - No Airtable booking created
   - No emails sent
   - Returns error message to form

See `workflow_code.js` lines 154-175 for decision logic.

## Common Debugging Steps

1. Check n8n execution logs: `docker compose -f infra/docker-compose.yml logs -f n8n`
2. Query recent executions: `docker exec -i $(docker compose -f infra/docker-compose.yml ps -q n8n-postgres) psql -U n8n -d n8n -f infra/query_executions.sql`
3. Inspect execution data: Use `infra/query_execution_data.sql` with execution ID
4. Verify Mailpit captured emails: http://localhost:8025
5. Enable stub mode and test with curl to isolate Airtable issues
6. Check Airtable table structures match expected schema in PROJECT_OVERVIEW.md

## Security Notes

- Never commit `.env` files or credential values
- Use placeholder IDs in workflow JSON exports
- Webhook endpoint should enforce API key validation in production
- Rotate Airtable PAT and email credentials regularly
- Basic auth credentials must be changed after initial n8n setup
