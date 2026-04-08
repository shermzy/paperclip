#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(path.resolve(__dirname, "..", ".env.local"));

const notionToken = process.env.NOTION_TOKEN;
const notionVersion = process.env.NOTION_VERSION ?? "2022-06-28";
const notionDatabaseId = process.env.NOTION_DATABASE_ID ?? "dc99c628fb044b6792ded329f3dc3353";
const paperclipApiBase = process.env.PAPERCLIP_API_BASE ?? "http://localhost:3100";
const paperclipCompanyId = process.env.PAPERCLIP_COMPANY_ID ?? "0f471b4d-1de0-489c-bc4a-df9559e2c6d2";
const paperclipCeoAgentId = process.env.PAPERCLIP_CEO_AGENT_ID ?? "9b52db08-5822-4160-82dd-f47c7c4eab78";
const dryRun = process.env.DRY_RUN === "1";

if (!notionToken) {
  console.error("Missing NOTION_TOKEN. Aborting intake sync.");
  process.exit(1);
}

function getPlainText(richTextArray) {
  if (!Array.isArray(richTextArray) || richTextArray.length === 0) return "";
  return richTextArray.map((node) => node?.plain_text ?? "").join("").trim();
}

function getTitle(prop) {
  return getPlainText(prop?.title ?? []);
}

function getRichText(prop) {
  return getPlainText(prop?.rich_text ?? []);
}

function getSelect(prop) {
  return prop?.select?.name ?? "";
}

function getMultiSelect(prop) {
  const list = Array.isArray(prop?.multi_select) ? prop.multi_select : [];
  return list.map((v) => v?.name).filter(Boolean);
}

function normalizePriority(priority) {
  const value = (priority ?? "").toLowerCase();
  if (value === "critical" || value === "high") return "high";
  if (value === "low") return "low";
  return "medium";
}

async function notionRequest(path, method, body) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion ${method} ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function paperclipRequest(path, method, body) {
  const response = await fetch(`${paperclipApiBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paperclip ${method} ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function fetchPendingRequests() {
  return notionRequest(`/databases/${notionDatabaseId}/query`, "POST", {
    filter: {
      and: [
        {
          or: [
            {
              property: "Workflow Stage",
              select: { equals: "Requested" },
            },
            {
              property: "Workflow Stage",
              select: { equals: "Triage" },
            },
          ],
        },
        {
          property: "Paperclip Issue ID",
          rich_text: { is_empty: true },
        },
      ],
    },
    page_size: 50,
  });
}

async function createPaperclipIssueFromNotion(page) {
  const props = page.properties ?? {};
  const requestTitle = getTitle(props.Request);
  const requestedBy = getRichText(props["Requested By"]);
  const requestType = getSelect(props.Type);
  const priorityLabel = getSelect(props.Priority);
  const services = getMultiSelect(props["Client Service"]);
  const notes = getRichText(props.Notes);
  const pageUrl = page.url;

  const issueTitle = `[Notion] ${requestTitle || "Untitled request"}`;
  const descriptionLines = [
    `Imported from Notion request card: ${pageUrl}`,
    "",
    `Type: ${requestType || "n/a"}`,
    `Priority: ${priorityLabel || "Medium"}`,
    `Requested By: ${requestedBy || "n/a"}`,
    `Client Service: ${services.length > 0 ? services.join(", ") : "n/a"}`,
  ];
  if (notes) {
    descriptionLines.push("", "Notes:", notes);
  }

  const issuePayload = {
    title: issueTitle,
    description: descriptionLines.join("\n"),
    status: "todo",
    priority: normalizePriority(priorityLabel),
    assigneeAgentId: paperclipCeoAgentId,
  };

  if (dryRun) {
    console.log(`[DRY RUN] Would create Paperclip issue for page ${page.id}: ${issueTitle}`);
    return { id: "dry-run", identifier: "DRY-RUN" };
  }

  return paperclipRequest(`/api/companies/${paperclipCompanyId}/issues`, "POST", issuePayload);
}

async function updateNotionAfterSync(pageId, issueIdentifier) {
  if (dryRun) return;

  const timestamp = new Date().toISOString();
  await notionRequest(`/pages/${pageId}`, "PATCH", {
    properties: {
      "Paperclip Issue ID": {
        rich_text: [{ text: { content: issueIdentifier } }],
      },
      "Workflow Stage": {
        select: { name: "Triage" },
      },
      "Assignee Agent": {
        select: { name: "intime-ceo" },
      },
      "Last Agent Update": {
        date: { start: timestamp },
      },
    },
  });
}

async function addNotionSyncComment(pageId, issueIdentifier) {
  if (dryRun) return;

  await notionRequest("/comments", "POST", {
    parent: { page_id: pageId },
    rich_text: [
      {
        type: "text",
        text: {
          content: `Synced to Paperclip as ${issueIdentifier} and assigned to intime-ceo. The agent was woken up for intake triage.`,
        },
      },
    ],
  });
}

async function wakeCeoAgent(issueIdentifier) {
  if (dryRun) return;

  await paperclipRequest(`/api/agents/${paperclipCeoAgentId}/wakeup`, "POST", {
    source: "assignment",
    triggerDetail: "system",
    reason: `New Notion request synced as ${issueIdentifier}`,
  });
}

async function run() {
  const pending = await fetchPendingRequests();
  const pages = Array.isArray(pending.results) ? pending.results : [];
  console.log(`Found ${pages.length} pending Notion request(s).`);

  for (const page of pages) {
    const issue = await createPaperclipIssueFromNotion(page);
    const issueIdentifier = issue.identifier ?? issue.id;
    await updateNotionAfterSync(page.id, issueIdentifier);
    await addNotionSyncComment(page.id, issueIdentifier);
    await wakeCeoAgent(issueIdentifier);
    console.log(`Synced page ${page.id} -> ${issueIdentifier}`);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
