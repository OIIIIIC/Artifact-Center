import {
  ARTIFACT_TYPES,
  ARTIFACT_REGISTRY,
  acceptedArtifactExtensions,
} from '@/lib/artifact-types'
import type { FileKind } from '@/types/upload'

export const ENABLED_FILE_TYPES: {
  kind: FileKind
  label: string
  ext: string
  enabled: boolean
}[] = [
  ...ARTIFACT_TYPES.map((kind) => ({
    kind,
    label: ARTIFACT_REGISTRY[kind].label,
    ext: ARTIFACT_REGISTRY[kind].extensions.join(' / '),
    enabled: true,
  })),
  { kind: 'ipa', label: 'IPA', ext: '.ipa', enabled: false },
  { kind: 'firmware', label: 'Firmware', ext: '.bin', enabled: false },
  { kind: 'docker', label: 'Docker', ext: 'image', enabled: false },
]

export const ACCEPT_ATTR = acceptedArtifactExtensions()

/** Mock pinned / recent application ids */
export const PINNED_APP_IDS = [
  'app-mobile-banking',
  'app-crm-desktop',
  'app-pos-terminal',
]

export const RECENT_APP_IDS = [
  'app-mobile-banking',
  'app-field-service',
  'app-device-agent',
  'app-ota-manager',
]
