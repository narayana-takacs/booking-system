# Project Overview

## Vision & Scope
We are delivering a Squarespace-hosted booking interface backed by n8n automation. Customers browse available time slots, submit a booking request via a form, and receive instant feedback. The system cross-references Airtable to validate client status, enforces provider working hours, blocks overlapping bookings, and notifies the provider when manual review is required.

## System Architecture
- **Squarespace Booking Form**: Embedded JavaScript widget that fetches availability, validates inputs, and posts booking payloads to the n8n webhook.
- **n8n Orchestrator** (`infra/docker-compose.yml`) with Postgres: Core workflow engine coordinating availability checks, Airtable lookups, calendar updates, and notifications.
- **Data Stores & APIs**: Airtable (client registry + status), Airtable tables for availability and bookings, plus a transactional email provider (SendGrid/SMTP or similar).

## Component Roles

- **Squarespace Booking Form**: Captures customer name, email address, booking reason, and requested slot; displays confirmation or follow-up instructions based on workflow responses.
- **n8n Orchestrator**: Validates payloads, queries Airtable, manages availability/bookings tables, generates optional .ics attachments, logs decisions, and returns structured API responses.
- **Airtable Availability Table**: Defines provider working windows; n8n ensures requested slots fall within published intervals.
- **Airtable Bookings Table**: Source of truth for accepted reservations and pending reviews; supports reporting and manual updates.
- **Transactional Email Service**: Sends confirmation emails (with optional .ics attachments) to clients and alerts to providers for deferred requests.
- **Postgres Backend**: Persists n8n executions, credentials metadata, and workflow state for auditing and recovery.
- **Docker Compose Stack**: Runs n8n and Postgres locally with reproducible configuration.
- **n8n Credential Vault**: Secure storage for Airtable and email provider secrets consumed by workflow nodes.
- **Future Calendar Integrations**: Reserved for optional Outlook/Google hooks; n8n architecture keeps a module boundary for later calendar sync without rewiring the core workflow.
## Booking Workflow
1. Client selects an available slot presented by the Squarespace form.
2. Frontend posts `{ name, email, bookingReason, requestedStart, requestedEnd }` to the n8n webhook with an auth token.
3. n8n confirms the slot fits within Airtable availability windows and that no overlapping booking exists in the Airtable bookings table.
4. Airtable lookup determines client status:
   - `active`: booking is accepted; event is written to the Bookings calendar, optional confirmation email is sent, and the booking reason is logged for reference.
   - `inactive` or `unknown`: booking is flagged for review; email and booking reason are stored in Airtable notes and the provider receives an alert email.
5. n8n responds with structured JSON so the Squarespace form can display success or "pending provider review".

## Availability Handling
- Availability calendar stores recurring work blocks; workflow derives free intervals by subtracting existing bookings.
- Buffer rules (e.g., 15-minute gap) configurable via environment variables.
- Overlaps are rejected before calendar writes occur.

## Airtable Integration
- Recommended structure:\n- **Clients** table: `Name`, `Email`, `Status` (`Active`/`Inactive`/`Unknown`), `Latest Reason`, `Notes`.\n- **Availability** table: `Start`, `End`, optional `Provider` or `Location`.\n- **Bookings** table: `Client Name`, `Email`, `Start`, `End`, `Booking Reason`, `Status`, `Decision Timestamp`, `Source`, `Client Status`, optional `Provider Notes`.
- n8n updates `BookingReason`, `Notes`, `LastRequestAt`, and `LastDecision` on each request, capturing onboarding context for inactive or unknown clients.
- Unknown clients trigger automated stub row creation for onboarding.

## Notifications & Reporting
- Accepted bookings can trigger confirmation emails to clients.
- Deferred requests notify providers with context (including booking reason) and Airtable record links.
- Optional daily digest summarizes upcoming bookings and outstanding pending clients.

## Security & Operations
- Secrets reside in n8n credentials; commit only placeholder values in `infra/.env.example`.
- Webhook protected by API key plus Squarespace origin checks.
- Airtable availability and booking tables act as the scheduling source of truth; keep them backed up or versioned as needed.
- Execution logs retained in Postgres; export to external monitoring if needed.
- Basic auth and owner credentials must be rotated after initial setup.

## Implementation Steps & Acceptance Criteria

### 1. Infrastructure Stack Online
- Execution Prompt:
  ```
  cp infra/.env.example infra/.env
  docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
  docker compose --env-file infra/.env -f infra/docker-compose.yml ps
  ```
- Acceptance Criteria:
  - n8n and Postgres containers report `Up` status with expected ports.
  - `curl -u ${N8N_BASIC_AUTH_USER}:${N8N_BASIC_AUTH_PASSWORD} http://127.0.0.1:5678/healthz` returns `{ "status": "ok" }`.

### 2. n8n Owner & Security Baseline
- Execution Prompt:
  ```
  Log in to n8n using basic auth (${N8N_BASIC_AUTH_USER} / ${N8N_BASIC_AUTH_PASSWORD}).
  Complete owner login via `/rest/login` with the credentials in infra/.env.
  Run SQL scripts (if required) to ensure the owner record has email, password hash, and auth identity.
  ```
- Acceptance Criteria:
  - Owner login succeeds with new credentials; old defaults no longer work.
  - Owner record shows `userActivated=true` and correct email in Postgres.

### 3. Credential Configuration
- Execution Prompt:
  ```
  Create Airtable Personal Access Token credential in n8n (use `AIRTABLE_PAT`).
  Store Airtable base/table IDs in n8n environment variables or workflow settings.
  Configure email provider credential (SMTP/API) for booking confirmations and provider alerts.
  ```
- Acceptance Criteria:
  - Airtable credential test returns HTTP 200 (`meta/whoami`).
  - Email credential sends a test message successfully (n8n test function or manual execution).
  - Credentials IDs are documented for workflow references without exposing secrets.

### 4. Workflow Import & Parameterization
- Execution Prompt:
  ```
  docker exec infra-n8n-1 n8n import:workflow --input /home/node/chatgpt_calendar.json --userId <owner-id>
  Update nodes: Airtable availability lookup, bookings upsert, email notifications, webhook response mapping.
  Configure .ics generation (Function node or Code node) referencing booking data.
  Activate the workflow and export updated JSON back to `workflows/`.
  ```
- Acceptance Criteria:
  - Manual test run on `/webhook/calendar` processes sample payload successfully (active + inactive cases).
  - Response JSON matches the Squarespace form contract (status, message, optional metadata, pending flag).

### 5. Airtable Availability & Booking Validation
- Execution Prompt:
  ```
  Populate Airtable availability table with working-hour records.
  Seed bookings table with conflicting and open slots.
  Trigger webhook payloads: active client, inactive client, unknown client, out-of-hours, overlapping slot.
  ```
- Acceptance Criteria:
  - Accepted requests create/modify Airtable booking rows only when compliant and attach .ics content for emails.
  - Deferred/unknown clients append Airtable notes (including booking reason) and send provider notifications without creating confirmed bookings.
  - Overlap/out-of-hours requests return descriptive rejection messages in webhook responses.

### 6. Squarespace Form Integration
- Execution Prompt:
  ```
  Deploy booking form script to Squarespace DEV page.
  Configure form to fetch availability JSON (from Airtable via n8n) and submit bookings to the webhook.
  ```
- Acceptance Criteria:
  - Form displays accurate available slots and requires email plus booking reason inputs.
  - Submissions show success or pending review states exactly as API responses.
  - Browser console/network logs confirm authenticated requests with no CORS issues.

### 7. Notification & Reporting Flows
- Execution Prompt:
  ```
  Enable confirmation and alert email nodes in n8n.
  Run manual executions for accepted and deferred bookings to validate email content (body + .ics attachment).
  Schedule daily digest workflow summarizing Airtable bookings/pending clients and monitor first execution.
  ```
- Acceptance Criteria:
  - Emails send with correct templates, recipients, booking reason, and .ics attachment when applicable.
  - Daily digest lists upcoming bookings and pending reviews from Airtable.
  - n8n logs show successful executions without retries.

### 8. Regression & Handover
- Execution Prompt:
  ```
  Document environment variables, credential IDs, Airtable table schemas, and workflow version hashes.
  Export final workflow JSON and include in release bundle.
  Conduct stakeholder demo covering booking scenarios, Airtable views, and email notifications.
  ```
- Acceptance Criteria:
  - Documentation details secret rotation cadence, Airtable backup process, and recovery steps.
  - Stakeholders approve demo; outstanding issues tracked in backlog.
  - Release package includes updated `AGENTS.md`, `PROJECT_OVERVIEW.md`, workflow export, and `.env` template.

