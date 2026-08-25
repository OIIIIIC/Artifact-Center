# Artifact Center MCP

This Codex plugin connects to Artifact Center without exposing destructive actions. It uses a platform Release Credential to discover permitted publishing targets, upload a completed build, update release notes, and explicitly promote a beta build to stable. It deliberately provides **no deletion tool**. Delete an artifact only in the Artifact Center web application.

## Authentication

Before first use, create a platform **Release Credential** in Artifact Center: **Settings → Release robots**. Then configure the MCP environment:

```powershell
$env:ARTIFACT_CENTER_URL = 'https://artifact-center.example.internal'
$env:ARTIFACT_CENTER_TOKEN = 'acrt_...'
```

The server limits this credential to `beta`/`stable`, and all robot uploads require `buildNumber`. This MCP always uploads with `markLatest: false`; selecting the official latest release remains a deliberate website/release workflow.

Run `artifact_center_check_authorization` first. It uses the release-specific API to verify the credential and return only publishable applications. The plugin never asks for, stores, or sends a personal password or browser JWT.

## Install in Codex

Install production dependencies, then register the local stdio server (replace the URL and one-time displayed credential):

```powershell
cd D:\MyCode\artifact-center\plugins\artifact-center-mcp
npm ci --omit=dev
codex mcp add artifact-center `
  --env ARTIFACT_CENTER_URL=https://artifact-center.example.internal `
  --env ARTIFACT_CENTER_TOKEN=acrt_... `
  -- node D:\MyCode\artifact-center\plugins\artifact-center-mcp\src\index.js
```

Restart Codex after registration, then run `artifact_center_check_authorization`. The credential is stored in the local Codex MCP configuration; protect the Windows user profile and revoke the credential from Artifact Center if the machine is lost or the value is exposed.

## Tools

- `artifact_center_check_authorization`
- `artifact_center_list_applications`
- `artifact_center_get_application`
- `artifact_center_upload_artifact`
- `artifact_center_update_artifact`

There is intentionally no delete tool and no hidden delete request path.

## Local development

```powershell
cd plugins/artifact-center-mcp
npm install
npm run check
```

The MCP uses Artifact Center's resumable upload protocol, so large files resume from already accepted parts. It supports proxy uploads and S3/MinIO signed part uploads.
