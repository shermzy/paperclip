# Intime Request Ops

Intime Request Ops is a local Paperclip company package for handling Intime client requests through a controlled multi-agent workflow.

## Workflow

1. Client adds/updates request in Notion.
2. `intime-ceo` triages and assigns.
3. `intime-product-manager` scopes and plans.
4. `intime-implementation-agent` executes with specialist support.
5. `intime-qa-release-agent` verifies and closes.
6. Specialists (`xero-expert`, `notion-expert`) are pulled in on demand.

## Org Chart

- `intime-ceo` (root)
- `intime-product-manager` → reports to `intime-ceo`
- `intime-implementation-agent` → reports to `intime-product-manager`
- `intime-qa-release-agent` → reports to `intime-product-manager`
- `xero-expert` → reports to `intime-product-manager`
- `notion-expert` → reports to `intime-product-manager`

## Notion Tracking Setup

- Page: Dev Work
- Database: Intime Agent Management
- Data source: `collection://f97fff4a-0d7a-49fe-9c72-1b234e010fc5`
- Kanban view: `Kanban - Agent Requests`
- Communication channel: Notion comments on each request card

## Scope Guardrails

This company is strictly for Intime work only.
All operational work must remain scoped to `E:\Intime` and Intime-owned services.

## Getting Started

```bash
pnpm paperclipai company import E:\Projects\paperclip\companies\intime-request-ops --target new --yes
```

## Automatic Intake Notification

To notify Paperclip agents whenever a new Notion request is logged:

1. Create `E:\Projects\paperclip\companies\intime-request-ops\.env.local` from `.env.example` and fill `NOTION_TOKEN`.
2. Run one-shot sync:

```bash
node E:\Projects\paperclip\companies\intime-request-ops\scripts\notion-intake-bridge.mjs
```

3. Register a per-minute scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File E:\Projects\paperclip\companies\intime-request-ops\scripts\register-intake-task.ps1
```

Behavior:
- Reads Notion cards in `Workflow Stage = Requested`, `Intime Only = true`, and empty `Paperclip Issue ID`.
- Creates a Paperclip issue assigned to `intime-ceo`.
- Writes back `Paperclip Issue ID`, moves stage to `Triage`, and adds a Notion comment.
- Wakes `intime-ceo` via `/api/agents/:id/wakeup` so the request is immediately picked up.

References:
- Agent Companies spec: https://agentcompanies.io/specification
- Paperclip: https://github.com/paperclipai/paperclip
