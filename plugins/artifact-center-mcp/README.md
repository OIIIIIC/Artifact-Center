# Artifact Center MCP

This local MCP connects to Artifact Center with either an account-bound **Personal MCP Credential** (`acmt_`) for platform management, or a legacy **Release Credential** (`acrt_`) for publishing only. Management permissions follow the bound account's current platform role and application membership, enforced by existing server handlers on every request.

## Account-bound management

Open **Settings → Personal MCP credentials**, enter a device name and validity (1–365 days, default 90), create a credential, and run the generated PowerShell setup command on the device running Codex. The command downloads the standalone client, checks SHA-256 and registers `artifact-center`; reconnect MCP afterwards. No repository checkout is needed. The credential is shown only once and is stored in the local Codex configuration; keep the setup command private.

Every account can create and individually revoke its own credentials. Account deletion, disabling, password resets and role changes revoke credentials using the existing token-version rules. Application membership changes take effect immediately. Expired or revoked credentials require a newly created credential. Delegated MCP credentials cannot mint new personal credentials or obtain browser JWTs via profile/password updates.

New named tools cover users and administrator transfer, products/projects, application settings and membership, batch access grants, artifacts/latest/deletion, releases, shares/collections, retention/cleanup, release credentials, audit, search, personal workspace, Jenkins connection/build configuration/build execution/logs/publications and download tickets. See `src/management.js` for the complete explicit operation catalog; MCP tool discovery returns each operation, required resource IDs, body guidance and query parameters. JSON body validation and all authorization remain server-side. This is not an arbitrary HTTP proxy.

Use `artifact_center_check_authorization` or `artifact_center_whoami` to inspect the bound account. `artifact_center_browse_applications` includes accessible viewer applications; the original `artifact_center_list_applications` returns publishing targets only. `artifact_center_manage_artifact` supports explicit latest selection and status/channel updates; `artifact_center_delete_artifact` and other delete tools use the existing permission checks. Download ticket tools return short-lived controlled download paths rather than loading binaries into the conversation. Management audit entries preserve the account and add `meta.source=mcp`.

Upgrade the API database with `0033_account_mcp_credentials` before deploying the new API/Web; back up and rehearse migrations before production. Re-run the website setup command to update the local bundled client. Existing `acrt_` credentials remain publishing-only and are never automatically upgraded.

## Authentication

Before first use, create a platform **Release Credential** in Artifact Center: **Settings → Release credentials**. Then configure the MCP environment:

```powershell
$env:ARTIFACT_CENTER_URL = 'https://artifact-center.example.internal'
$env:ARTIFACT_CENTER_TOKEN = 'acrt_...'
```

The server limits this credential to `beta`/`stable`, and all robot uploads require `buildNumber`. This MCP always uploads with `markLatest: false`; selecting the official latest release remains a deliberate website/release workflow.

Run `artifact_center_check_authorization` first. It uses the release-specific API to verify the credential and return only publishable applications. The plugin never asks for, stores, or sends a personal password or browser JWT.

## Install in Codex

The recommended installation does not require this repository. In Artifact Center,
open **Settings → Release credentials**, create a credential, copy the generated PowerShell
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

The seven original publishing tools remain compatible. Additional management tools require an account-bound `acmt_` credential. Publishing credentials cannot access the account management APIs.

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

Plans last 30 minutes in the current MCP process (maximum ten pending plans); restarting requires a fresh preview. Temporary snapshots use up to the artifact size in local temporary storage. Publishing never implicitly selects latest; account-bound management tools can explicitly select latest or delete according to server permissions.

### Upgrade

Deploy migration `0028_repository_bindings` with the API and web build, then re-run the generated MCP installation command. The upload tool's old direct `applicationId`/`filePath` arguments are intentionally replaced by the preview contract. Existing CI upload APIs remain compatible.
