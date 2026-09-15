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

The recommended installation does not require this repository. In Artifact Center,
open **Settings → Release robots**, create a credential, copy the generated PowerShell
setup command, and run it on the Windows device where Codex is installed. The command:

1. downloads the standalone MCP client from the same Artifact Center deployment;
2. verifies its published SHA-256 checksum;
3. stores it under the current user's local application-data directory; and
4. registers it as a local stdio MCP server in Codex.

The local client remains necessary because it reads build files from the device before
uploading them. It is distributed as one bundled file and does not require a checkout,
`npm install`, or access to the Artifact Center source repository.

## Install from source for development

Install dependencies, then register the source entry point (replace the URL and
one-time displayed credential):

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
- `artifact_center_match_repository` — inspect local Git and return exact permitted targets plus local build recipe
- `artifact_center_prepare_upload` — snapshot a built file and return the complete publishing preview
- `artifact_center_upload_artifact` — accepts only `planId` and `confirmed: true` after the user confirms the preview
- `artifact_center_update_artifact`

There is intentionally no delete tool and no hidden delete request path.

## Local development

```powershell
cd plugins/artifact-center-mcp
npm install
npm run check
```

`npm run build` creates the standalone files in `dist/`. The frontend publishes them
as `/downloads/artifact-center-mcp.mjs` and
`/downloads/artifact-center-mcp.sha256`.

The MCP uses Artifact Center's resumable upload protocol, so large files resume from already accepted parts. It supports proxy uploads and S3/MinIO signed part uploads.

## Repository-bound publishing

In **Application → Settings → Basic → Repository publishing bindings**, add the clone URL, exact branch and code directory (empty for repository root). Multiple bindings per application are supported. SSH/HTTPS clone URLs match the same host/path; path case and non-default ports remain significant. Product/Project organize applications; the upload destination is always an Application.

The host calls `artifact_center_match_repository` with the absolute local application directory and Git remote (default `origin`). No match requires configuring a binding; multiple matches require selecting an application. Detached HEAD is rejected.

Place a declarative `artifact-center.release.json` in that application directory, for example:

```json
{
  "commands": {
    "test": "npm test",
    "typecheck": "npm run typecheck",
    "build": "npm run build"
  },
  "artifact": { "path": "output/application.zip", "platform": "linux" },
  "version": { "file": "package.json", "jsonPath": "version" },
  "buildNumber": { "file": "output/build-info.json", "jsonPath": "buildNumber" }
}
```

These are examples: use commands and files declared by the actual project. The host inspects and runs the commands locally in order, stops on failure, reads declared version sources after build, and prepares Chinese release notes. The MCP does not execute repository commands. No application ID or token belongs in this recipe.

Call `artifact_center_prepare_upload` with `directory`, optional selected `applicationId`, `filePath`, `version`, `buildNumber`, `platform`, `channel` and `releaseNotes`. Display the returned application/product, branch/commit, file/size/SHA256, version/build, channel, notes and `markLatest:false`. **Wait for explicit user confirmation of this completed preview**, including for beta. The initial request to publish is not confirmation of the preview. Stable requires explicit production intent.

Then call `artifact_center_upload_artifact` with only `{ "planId": "<returned id>", "confirmed": true }`. It rechecks the target and file, uploads the reviewed snapshot, verifies the stored artifact, and returns `pagePath`. Resolve `pagePath` against the Artifact Center website origin for the user. A changed or expired preview must be prepared and confirmed again. Accepted uploads consume their plan even if verification fails; inspect the reported artifact ID before creating another upload.

Plans last 30 minutes in the current MCP process (maximum ten pending plans); restarting requires a fresh preview. Temporary snapshots use up to the artifact size in local temporary storage. `latest` selection and deletion remain website operations.

### Upgrade

Deploy migration `0028_repository_bindings` with the API and web build, then re-run the generated MCP installation command. The upload tool's old direct `applicationId`/`filePath` arguments are intentionally replaced by the preview contract. Existing CI upload APIs remain compatible.
