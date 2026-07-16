import type { FileKind } from '@/types/upload'

export const ENABLED_FILE_TYPES: {
  kind: FileKind
  label: string
  ext: string
  enabled: boolean
}[] = [
  { kind: 'apk', label: 'APK', ext: '.apk', enabled: true },
  { kind: 'aab', label: 'AAB', ext: '.aab', enabled: true },
  { kind: 'exe', label: 'EXE', ext: '.exe', enabled: true },
  { kind: 'zip', label: 'ZIP', ext: '.zip', enabled: true },
  { kind: 'ipa', label: 'IPA', ext: '.ipa', enabled: false },
  { kind: 'firmware', label: 'Firmware', ext: '.bin', enabled: false },
  { kind: 'docker', label: 'Docker', ext: 'image', enabled: false },
]

export const ACCEPT_ATTR = '.apk,.aab,.exe,.msi,.zip'

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
