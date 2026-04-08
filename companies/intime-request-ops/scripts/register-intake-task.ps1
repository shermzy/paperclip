param(
  [string]$TaskName = "Paperclip-Intime-Notion-Intake",
  [string]$NodeExe = "node",
  [string]$WorkingDirectory = "E:\Projects\paperclip\companies\intime-request-ops\scripts"
)

$scriptPath = Join-Path $WorkingDirectory "notion-intake-bridge.mjs"
if (!(Test-Path $scriptPath)) {
  Write-Error "Bridge script not found at $scriptPath"
  exit 1
}

$action = "$NodeExe `"$scriptPath`""

schtasks /Delete /TN $TaskName /F | Out-Null
schtasks /Create `
  /SC MINUTE `
  /MO 1 `
  /TN $TaskName `
  /TR $action `
  /F | Out-Null

Write-Output "Scheduled task '$TaskName' created to run every minute."
Write-Output "Ensure these environment variables are set for the account running the task:"
Write-Output "NOTION_TOKEN, PAPERCLIP_API_BASE, PAPERCLIP_COMPANY_ID, PAPERCLIP_CEO_AGENT_ID, NOTION_DATABASE_ID"
