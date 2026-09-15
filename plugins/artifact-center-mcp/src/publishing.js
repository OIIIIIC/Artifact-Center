import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream, rmSync } from 'node:fs'
import { mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ArtifactCenterError } from './client.js'

const exec = promisify(execFile)
const plans = new Map()
const ttl = 30 * 60 * 1000
// Only directories created by this process are removed; never accept a cleanup path from input.
process.once('exit', () => {
  for (const plan of plans.values()) {
    try {
      rmSync(plan.snapshotDirectory, { recursive: true, force: true })
    } catch {
      /* OS may retain a locked temporary file. */
    }
  }
})
setInterval(() => {
  void cleanupExpired().catch(() => {})
}, 60_000).unref()
const git = async (cwd, args) =>
  (
    await exec('git', ['-C', cwd, ...args], { windowsHide: true, maxBuffer: 1024 * 1024 })
  ).stdout.trim()

export async function inspectRepository(directory, remote = 'origin') {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote))
    throw new ArtifactCenterError('Invalid remote name')
  const cwd = await realpath(resolve(directory))
  const root = await realpath(await git(cwd, ['rev-parse', '--show-toplevel']))
  const branch = await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(
    () => '',
  )
  if (!branch)
    throw new ArtifactCenterError('Detached HEAD: check out the branch to publish')
  const repository = await git(root, ['remote', 'get-url', remote])
  // Do not return embedded HTTP credentials to the host or platform.
  if (/^https?:\/\//i.test(repository) && new URL(repository).username)
    throw new ArtifactCenterError('Remove credentials from the Git remote URL')
  return {
    root,
    repository,
    branch,
    directory: relative(root, cwd).replace(/\\/g, '/'),
    commit: await git(root, ['rev-parse', 'HEAD']),
    changes: await git(root, ['status', '--porcelain']),
    diffSha256: createHash('sha256')
      .update(await git(root, ['diff', '--no-ext-diff', '--binary', 'HEAD']))
      .digest('hex'),
    remote,
  }
}

export async function matchRepository(client, { directory, remote = 'origin' }) {
  const context = await inspectRepository(directory, remote)
  const query = new URLSearchParams({
    repository: context.repository,
    branch: context.branch,
    directory: context.directory,
  })
  const result = await client.get(`/release/applications?${query}`)
  return { context, ...result, selectionRequired: result.items.length !== 1 }
}

export async function readBuildRecipe(directory) {
  const path = join(resolve(directory), 'artifact-center.release.json')
  let recipe
  try {
    recipe = JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return { configured: false, expectedPath: path }
    throw new ArtifactCenterError('Invalid artifact-center.release.json')
  }
  // This is declarative input for the host, never executed by the MCP server.
  return {
    configured: true,
    path,
    commands: recipe.commands,
    artifact: recipe.artifact,
    version: recipe.version,
    buildNumber: recipe.buildNumber,
  }
}

async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function cleanupExpired() {
  for (const [id, plan] of plans) {
    if (!plan.running && plan.expiresAt < Date.now()) {
      await rm(plan.snapshotDirectory, { recursive: true, force: true })
      plans.delete(id)
    }
  }
}

export async function prepareUpload(client, input) {
  await cleanupExpired()
  if (plans.size >= 10)
    throw new ArtifactCenterError('Too many pending previews; confirm or wait for expiry')
  const matched = await matchRepository(client, input)
  const selected = input.applicationId
    ? matched.items.find((item) => item.id === input.applicationId)
    : matched.items.length === 1
      ? matched.items[0]
      : undefined
  if (!selected)
    throw new ArtifactCenterError(
      'Select one exact application from repository matches before preparing an upload',
    )
  const { target } = await client.get(
    `/release/applications/${encodeURIComponent(selected.id)}/target`,
  )
  if (target.platform !== input.platform)
    throw new ArtifactCenterError('Artifact platform does not match application')
  const path = await realpath(resolve(input.directory, input.filePath))
  const subpath = relative(matched.context.root, path)
  if (
    isAbsolute(subpath) ||
    subpath === '..' ||
    subpath.startsWith(`..\\`) ||
    subpath.startsWith('../')
  )
    throw new ArtifactCenterError('Artifact must be inside the repository')
  const metadata = await stat(path)
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > 512 * 1024 * 1024)
    throw new ArtifactCenterError('Artifact must be a non-empty file up to 512 MiB')
  const extensions = {
    android: /\.(apk|aab)$/i,
    windows: /\.(exe|msi)$/i,
    linux: /\.(zip|tar|tar\.gz|tgz|deb|rpm|appimage)$/i,
  }
  if (!extensions[input.platform]?.test(path))
    throw new ArtifactCenterError('Artifact extension does not match platform')
  const snapshotDirectory = await mkdtemp(join(tmpdir(), 'artifact-center-preview-'))
  try {
    const snapshotPath = join(snapshotDirectory, basename(path))
    await pipeline(
      createReadStream(path),
      createWriteStream(snapshotPath, { flags: 'wx', mode: 0o600 }),
    )
    const sha256 = await digest(snapshotPath)
    if (
      (await stat(snapshotPath)).size !== metadata.size ||
      (await digest(path)) !== sha256
    )
      throw new ArtifactCenterError('Artifact changed while preparing preview')
    const planId = randomUUID()
    const expiresAt = Date.now() + ttl
    const upload = {
      applicationId: selected.id,
      filePath: snapshotPath,
      version: input.version,
      buildNumber: input.buildNumber,
      platform: input.platform,
      channel: input.channel ?? 'beta',
      releaseNotes: input.releaseNotes ?? '',
    }
    const preview = {
      planId,
      target,
      source: matched.context,
      filePath: path,
      filename: basename(path),
      sizeBytes: metadata.size,
      sha256,
      version: upload.version,
      buildNumber: upload.buildNumber,
      channel: upload.channel,
      releaseNotes: upload.releaseNotes,
      markLatest: false,
      expiresAt: new Date(expiresAt).toISOString(),
    }
    plans.set(planId, {
      upload,
      preview,
      input,
      snapshotDirectory,
      expiresAt,
      running: false,
      baseUrl: client.baseUrl,
      token: client.token,
    })
    return preview
  } catch (error) {
    await rm(snapshotDirectory, { recursive: true, force: true })
    throw error
  }
}

export async function confirmUpload(client, { planId, confirmed }) {
  await cleanupExpired()
  const plan = plans.get(planId)
  if (confirmed !== true || !plan || plan.running)
    throw new ArtifactCenterError(
      'A valid preview and explicit user confirmation are required',
    )
  if (client.baseUrl !== plan.baseUrl || client.token !== plan.token)
    throw new ArtifactCenterError('Publishing connection changed; prepare a new preview')
  plan.running = true
  try {
    const matched = await matchRepository(client, plan.input)
    const { target } = await client.get(
      `/release/applications/${encodeURIComponent(plan.upload.applicationId)}/target`,
    )
    if (
      !matched.items.some((item) => item.id === plan.upload.applicationId) ||
      JSON.stringify(target) !== JSON.stringify(plan.preview.target) ||
      JSON.stringify(matched.context) !== JSON.stringify(plan.preview.source)
    )
      throw new ArtifactCenterError(
        'Repository or target changed; prepare and confirm a new preview',
      )
    if (
      (await digest(plan.preview.filePath)) !== plan.preview.sha256 ||
      (await digest(plan.upload.filePath)) !== plan.preview.sha256
    )
      throw new ArtifactCenterError('Artifact changed; prepare and confirm a new preview')
    // Upload the reviewed snapshot, so a concurrent build cannot replace its bytes.
    const result = await client.uploadArtifact(plan.upload)
    // Once accepted, consume the plan even when verification fails; never duplicate it on retry.
    plans.delete(planId)
    const id = result.artifact?.id
    if (!id)
      throw new ArtifactCenterError(
        'Upload returned no artifact ID; verify in Artifact Center',
      )
    const verified = await client.get(
      `/release/artifacts/${encodeURIComponent(id)}/verify`,
    )
    const artifact = verified.artifact
    for (const field of [
      'applicationId',
      'version',
      'buildNumber',
      'platform',
      'channel',
      'releaseNotes',
    ]) {
      if (artifact?.[field] !== plan.upload[field])
        throw new ArtifactCenterError(
          `Uploaded artifact ${id} failed verification: ${field}`,
        )
    }
    if (
      !verified.available ||
      artifact.sha256 !== plan.preview.sha256 ||
      artifact.sizeBytes !== plan.preview.sizeBytes ||
      verified.target?.region?.code !== plan.preview.target.region.code
    )
      throw new ArtifactCenterError(
        `Uploaded artifact ${id} failed file or target verification`,
      )
    return verified
  } finally {
    plan.running = false
    if (!plans.has(planId))
      await rm(plan.snapshotDirectory, { recursive: true, force: true })
  }
}
