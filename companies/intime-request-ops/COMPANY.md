---
name: Intime Request Ops
description: Intime-only client request operations company that triages, executes, and tracks delivery through Notion.
slug: intime-request-ops
schema: agentcompanies/v1
version: 1.0.0
license: MIT
authors:
  - name: Intime
---

Intime Request Ops is an Intime-only company for managing client requests with a clear triage-to-delivery pipeline.

Workflow:
1. Clients create or update requests in the Notion board.
2. Agents coordinate delivery in Paperclip while keeping customer communication in Notion comments.
3. Every request must stay scoped to Intime services and assets only.

Notion board:
- Database: Intime Agent Management
- Parent page: Dev Work
- Data source: collection://f97fff4a-0d7a-49fe-9c72-1b234e010fc5
- Kanban view: Kanban - Agent Requests