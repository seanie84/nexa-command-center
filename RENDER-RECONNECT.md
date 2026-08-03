RENDER RECONNECT INSTRUCTIONS

Purpose
-------
This file contains step-by-step instructions and copy-paste scripts to reconnect the Render service "command-center" to the correct GitHub repository (seanie84/nexa-command-center) and trigger a manual deploy. Use the GUI steps if you're not comfortable sharing credentials. If you prefer, provide a Render API key or a Deploy Hook URL and I will perform the reconnect and deploy for you.

Option A — GUI (quick, recommended if you have dashboard access)
---------------------------------------------------------------
1. Open https://dashboard.render.com and sign in.
2. Select the "command-center" service from the list.
3. Click the Settings tab.
4. Under GitHub (Repository) click "Change repo".
5. Choose the repository: seanie84/nexa-command-center and branch: main. Save.
6. Back on the service page click the "Manual Deploy" button → "Deploy latest commit".
7. Open the Logs tab and watch build steps (npm install, vite build, server start).
8. Verify health: curl -s https://command-center-bgwj.onrender.com/health | jq .

Option B — Trigger deploy with Deploy Hook (no API key required)
----------------------------------------------------------------
If you have a Render Deploy Hook URL (from Service → Webhooks → Deploy Hook), run:

Bash:
  curl -X POST "<DEPLOY_HOOK_URL>"

PowerShell:
  Invoke-RestMethod -Method Post -Uri "<DEPLOY_HOOK_URL>"

After triggering, watch the Render UI Logs. Verify the site and health endpoint.

Option C — Programmatic (use this if you provide a Render API key & Service ID)
------------------------------------------------------------------------------
Important: Do NOT share your API key publicly. Paste it into the PowerShell script below before running locally.

PowerShell (patch repo + trigger deploy):

$apiKey = 'RENDER_API_KEY_GOES_HERE'
$serviceId = 'srv-d97qhsd7vec73cco38k0'  # from Render UI (Service ID)
$newRepo = 'seanie84/nexa-command-center'
$branch = 'main'

# 1) Update repository the service points to (Render API may require repository object)
$body = @{
  repository = @{ name = $newRepo; branch = $branch }
} | ConvertTo-Json

Invoke-RestMethod -Method Patch -Uri "https://api.render.com/v1/services/$serviceId" -Headers @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/json" } -Body $body

# 2) Trigger manual deploy (clear cache optional)
$deployBody = @{ clearCache = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers @{ Authorization = "Bearer $apiKey"; "Content-Type" = "application/json" } -Body $deployBody

# 3) Poll health (optional)
Start-Sleep -Seconds 10
Invoke-WebRequest -Uri "https://command-center-bgwj.onrender.com/health" -UseBasicParsing | Select-Object -ExpandProperty Content

Notes on Render API: API request field names sometimes differ by account type. If the PATCH fails with a 4xx, provide the API response and I will adapt the payload and execute it safely for you.

Option D — Minimal manual steps for non-technical users
------------------------------------------------------
1. Log into Render
2. Open the command-center service
3. Settings → Change repo → select seanie84/nexa-command-center → Save
4. Manual Deploy → Deploy latest commit
5. Open Logs → copy any errors and paste them here for diagnosis

What I will do if given credentials
-----------------------------------
- Patch the service to the correct repo
- Trigger a manual deploy with cache clear
- Stream and inspect build logs for failures
- Verify /health and the SPA loads at https://command-center-bgwj.onrender.com
- If build fails, diagnose logs and create needed fixes, open PRs if required

Security and Privacy
--------------------
- Never paste API keys into public chat. If you provide credentials, use ephemeral channels or paste them into the Render CLI on your machine and then delete them.
- I will not store your API key permanently — after use I will remove it from any temporary files I create and report success/failure.

If you want me to proceed now, provide one of the following (paste securely):
- Deploy Hook URL (I will trigger a deploy), OR
- Render API Key + Service ID (I will reconnect and deploy), OR
- Tell me you’ll reconnect manually and I’ll wait for your confirmation.

-- End of file
