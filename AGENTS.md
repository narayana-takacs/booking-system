# Repository Guidelines

## Project Structure & Module Organization
- `infra/` contains the Docker stack for n8n and Postgres. Use `docker-compose.yml` to launch the automation runtime, and `.env.example` as the template for local secrets.
- `workflows/` stores exported n8n workflows. `chatgpt_calendar.json` (rename when ready) is the canonical booking automation definition.
- Add documentation or helper scripts under `docs/` and `scripts/` respectively. Keep runtime configuration artefacts out of workflow exports.

## Build, Test, and Development Commands
- `docker compose --env-file infra/.env up -d` starts n8n + Postgres. Re-run with `--build` after dependency updates.
- `docker compose logs -f n8n` streams workflow execution logs for debugging availability checks and notifications.
- `docker compose down -v` resets the environment, including credentials; only use when you intend to rebuild from scratch.

## Coding Style & Naming Conventions
- Maintain declarative JSON exports for n8n workflows. Name nodes with clear actions (`Check Availability`, `Create Booking Event`).
- Secrets belong in `.env` or n8n credentials, never committed to git. Placeholder IDs such as `<airtable-credential-id>` must be swapped locally.
- YAML uses two-space indentation; shell scripts should remain POSIX-compliant when possible.

## Testing Guidelines
- Validate workflow changes against a staging Airtable base (availability + bookings tables) before export.
- Capture sample webhook payloads from Squarespace form submissions and replay them during development.
- Lint JSON exports with `npx jsonlint workflows/chatgpt_calendar.json` (or equivalent) prior to commits.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`). Separate infra adjustments and workflow edits when feasible.
- PRs should describe workflow updates, include evidence of manual tests (execution IDs or screenshots), and document new environment variables.
- Reference relevant issues and highlight any breaking changes so operators can coordinate deployments.

## Security & Operations
- Rotate Airtable and email provider credentials regularly, updating n8n records immediately after rotation.
- Enforce webhook API key checks (and optional IP allow lists) before running booking logic.
- Audit n8n execution logs periodically and plan retention/archival according to compliance requirements.

## Next Steps Checklist
- Launch Docker stack (`docker compose --env-file infra/.env -f infra/docker-compose.yml up -d`).
- Complete owner signup in n8n, rotate basic auth credentials, and create requisite Airtable + email credentials.
- Import `workflows/chatgpt_calendar.json`, update credential references, and validate booking scenarios against staging Airtable tables and email (.ics) outputs.




