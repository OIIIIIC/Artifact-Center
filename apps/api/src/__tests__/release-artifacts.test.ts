import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { artifacts, releases } from '../db/schema.js'

const database = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  transaction: vi.fn(),
}))

const auditWrite = vi.hoisted(() => vi.fn())

const auth = vi.hoisted(() => ({
  credential: {
    kind: 'release-credential' as const,
    id: 'credential-1',
    name: 'Bino workstation',
  },
  userId: 'uploader-1',
}))

vi.mock('../db/client.js', () => ({
  db: {
    select: database.select,
    update: database.update,
    transaction: database.transaction,
  },
}))
vi.mock('../middleware/upload-auth.js', () => ({
  requireUploadAuth: async (
    c: { set: (key: string, value: unknown) => void },
    next: () => Promise<void>,
  ) => {
    c.set('user', {
      sub: auth.userId,
      name: 'Release Admin',
      email: 'admin@example.com',
      role: 'admin',
      tokenVersion: 1,
    })
    c.set('uploadCredential', auth.credential)
    await next()
  },
}))
vi.mock('../middleware/application-access.js', () => ({
  hasApplicationRole: vi.fn(async () => true),
}))
vi.mock('../lib/audit.js', () => ({ writeAudit: auditWrite }))

import { releaseArtifactRoutes } from '../routes/release-artifacts.js'

const artifact = {
  id: 'artifact-1',
  applicationId: 'application-1',
  releaseId: 'release-1',
  version: '1.2.3',
  buildNumber: '123',
  platform: 'android' as const,
  type: 'apk' as const,
  channel: 'beta' as const,
  status: 'beta' as const,
  originalFilename: 'app.apk',
  filename: 'cn-app-1.2.3-123-beta.apk',
  sizeBytes: 42,
  sha256: null,
  storageKey: 'application-1/app.apk',
  storageBackend: 'local',
  releaseNotes: 'initial notes',
  uploaderId: 'uploader-1',
  uploaderName: 'Release Admin',
  parsedMeta: null,
  buildMeta: null,
  uploadedAt: new Date('2026-08-19T00:00:00.000Z'),
  updatedAt: new Date('2026-08-19T00:00:00.000Z'),
  deprecatedAt: null,
}

function selectArtifact(row: unknown) {
  const query = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  database.select.mockReturnValue(query)
  query.from.mockReturnValue(query)
  query.where.mockReturnValue(query)
  query.limit.mockResolvedValue(row ? [row] : [])
}

function updateArtifact(row: unknown) {
  const query = { set: database.set, where: vi.fn(), returning: database.returning }
  database.update.mockReturnValue(query)
  database.set.mockReturnValue(query)
  query.where.mockReturnValue(query)
  database.returning.mockResolvedValue([row])
}

function createApp() {
  const app = new Hono()
  app.route('/release', releaseArtifactRoutes)
  return app
}

describe('MCP 安全发布修改接口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.credential = {
      kind: 'release-credential',
      id: 'credential-1',
      name: 'Bino workstation',
    }
    auth.userId = 'uploader-1'
    database.transaction.mockImplementation(async (callback) =>
      callback({ update: database.update }),
    )
  })

  it('发布机器人可更新自己上传的 beta 制品备注', async () => {
    selectArtifact(artifact)
    updateArtifact({ ...artifact, releaseNotes: 'fixed notes' })

    const response = await createApp().request('/release/artifacts/artifact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseNotes: 'fixed notes' }),
    })

    expect(response.status).toBe(200)
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({ releaseNotes: 'fixed notes' }),
    )
    expect(database.transaction).toHaveBeenCalledOnce()
    expect(database.update).toHaveBeenCalledTimes(3)
    expect(database.update).toHaveBeenNthCalledWith(1, artifacts)
    expect(database.update).toHaveBeenNthCalledWith(2, releases)
    expect(database.update).toHaveBeenNthCalledWith(3, artifacts)
    expect(database.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ releaseNotes: 'fixed notes' }),
    )
    expect(database.set).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ releaseNotes: 'fixed notes' }),
    )
    expect(auditWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorName: 'Bino workstation',
        meta: expect.objectContaining({
          via: 'release-credential',
          releaseCredentialId: 'credential-1',
          releaseCredentialName: 'Bino workstation',
        }),
      }),
    )
  })

  it('稳定版提升必须显式确认，且接口没有 latest 入口', async () => {
    const response = await createApp().request('/release/artifacts/artifact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promoteToStable: true, markLatest: true }),
    })

    expect(response.status).toBe(400)
    expect(database.select).not.toHaveBeenCalled()
    expect(database.update).not.toHaveBeenCalled()
  })

  it('确认后仅把 beta 提升为 stable，绝不设为 latest', async () => {
    selectArtifact(artifact)
    updateArtifact({ ...artifact, channel: 'stable', status: 'stable' })

    const response = await createApp().request('/release/artifacts/artifact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoteToStable: true,
        confirmStablePromotion: true,
        markLatest: true,
      }),
    })

    expect(response.status).toBe(200)
    expect(database.set).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'stable', status: 'stable' }),
    )
    await expect(response.json()).resolves.toMatchObject({
      artifact: { channel: 'stable', status: 'stable' },
    })
  })

  it('发布机器人不能修改由其他人上传的制品', async () => {
    selectArtifact({ ...artifact, uploaderId: 'another-uploader' })

    const response = await createApp().request('/release/artifacts/artifact-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseNotes: 'attempted edit' }),
    })

    expect(response.status).toBe(403)
    expect(database.update).not.toHaveBeenCalled()
  })
})
