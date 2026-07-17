import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getArtifactsForApplication as getMockArtifacts } from '@/mocks/artifacts'
import { useApplicationsStore } from '@/store/applications-store'
import type { ApplicationPlatform } from '@/types/application'
import type { Artifact, ArtifactStatus } from '@/types/artifact'
import type { UploadChannel } from '@/types/upload'

export type PublishArtifactInput = {
  applicationId: string
  version: string
  buildNumber: string
  platform: ApplicationPlatform
  sizeBytes: number
  filename: string
  releaseNotes?: string
  channel?: UploadChannel
  markLatest?: boolean
  uploader?: string
}

interface ArtifactsState {
  /** User-published artifacts (prepended when listed) */
  published: Artifact[]
  publishArtifact: (input: PublishArtifactInput) => Artifact
  getForApplication: (applicationId: string) => Artifact[]
  getLatest: (applicationId: string) => Artifact | undefined
}

function channelToStatus(
  channel: UploadChannel | undefined,
  markLatest: boolean,
): ArtifactStatus {
  // Latest is a flag on status; channel is stored separately on the artifact
  if (markLatest) return 'latest'
  if (channel === 'beta') return 'beta'
  if (channel === 'deprecated') return 'deprecated'
  return 'stable'
}

function statusFromChannel(channel: UploadChannel | undefined): ArtifactStatus {
  if (channel === 'beta') return 'beta'
  if (channel === 'deprecated') return 'deprecated'
  return 'stable'
}

export const useArtifactsStore = create<ArtifactsState>()(
  persist(
    (set, get) => ({
      published: [],
      getForApplication: (applicationId) => {
        const published = get().published.filter((a) => a.applicationId === applicationId)
        const hasPublishedLatest = published.some((a) => a.status === 'latest')
        const mocks = getMockArtifacts(applicationId).map((m) => {
          // Ensure mocks have a channel for dual badges
          const withChannel: Artifact = {
            ...m,
            channel:
              m.channel ??
              (m.status === 'beta' || /-beta/i.test(m.version)
                ? 'beta'
                : m.status === 'deprecated' || m.status === 'archived'
                  ? 'deprecated'
                  : 'stable'),
          }
          if (hasPublishedLatest && withChannel.status === 'latest') {
            return {
              ...withChannel,
              status: statusFromChannel(withChannel.channel),
            }
          }
          return withChannel
        })
        const pubIds = new Set(published.map((a) => a.id))
        return [...published, ...mocks.filter((m) => !pubIds.has(m.id))]
      },
      getLatest: (applicationId) => {
        const list = get().getForApplication(applicationId)
        return list.find((a) => a.status === 'latest') ?? list[0]
      },
      publishArtifact: (input) => {
        const markLatest = input.markLatest !== false
        const channel: UploadChannel = input.channel ?? 'stable'
        const now = new Date().toISOString()
        const id = `pub-${input.applicationId}-${Date.now().toString(36)}`

        const artifact: Artifact = {
          id,
          applicationId: input.applicationId,
          version: input.version.trim(),
          buildNumber: input.buildNumber.trim(),
          platform: input.platform,
          sizeBytes: input.sizeBytes,
          uploadedAt: now,
          uploader: input.uploader?.trim() || 'Demo User',
          status: channelToStatus(channel, markLatest),
          channel,
          releaseNotes: input.releaseNotes?.trim() || '',
          filename: input.filename,
        }

        set((s) => {
          let next = s.published
          if (markLatest) {
            // Demote previous latest but keep their channel badge
            next = next.map((a) =>
              a.applicationId === input.applicationId && a.status === 'latest'
                ? {
                    ...a,
                    status: statusFromChannel(a.channel),
                  }
                : a,
            )
          }
          return { published: [artifact, ...next] }
        })

        useApplicationsStore.getState().recordPublish(input.applicationId, {
          version: artifact.version,
          markLatest,
        })

        return artifact
      },
    }),
    {
      name: 'artifact-center-artifacts',
      partialize: (s) => ({ published: s.published }),
    },
  ),
)
