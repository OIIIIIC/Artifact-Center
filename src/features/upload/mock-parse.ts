import type { Application } from '@/types/application'
import type { ApplicationPlatform } from '@/types/application'
import type { FileKind, ParsedArtifactFile } from '@/types/upload'

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function detectFileKind(filename: string): FileKind {
  const ext = extOf(filename)
  if (ext === 'apk') return 'apk'
  if (ext === 'aab') return 'aab'
  if (ext === 'exe' || ext === 'msi') return 'exe'
  if (ext === 'zip') return 'zip'
  if (ext === 'ipa') return 'ipa'
  if (ext === 'bin' || ext === 'img' || ext === 'hex') return 'firmware'
  if (ext === 'tar' || filename.includes('docker')) return 'docker'
  return 'unknown'
}

export function platformFromKind(kind: FileKind): ApplicationPlatform | null {
  if (kind === 'apk' || kind === 'aab') return 'android'
  if (kind === 'exe') return 'windows'
  if (kind === 'zip') return 'zip'
  return null
}

export function isEnabledKind(kind: FileKind): boolean {
  return kind === 'apk' || kind === 'aab' || kind === 'exe' || kind === 'zip'
}

/** Mock sha256-looking digest from name + size */
export function mockHash(name: string, size: number): string {
  let h = size >>> 0
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b1) >>> 0
  }
  const a = h.toString(16).padStart(8, '0')
  const b = (~h >>> 0).toString(16).padStart(8, '0')
  const c = (h ^ 0xabcdef01).toString(16).padStart(8, '0')
  const d = ((h * 2654435761) >>> 0).toString(16).padStart(8, '0')
  return `${a}${b}${c}${d}${a}${b}${c}${d}`.slice(0, 64)
}

function bumpPatch(version: string): string {
  const core = version.replace(/-.*$/, '')
  const parts = core.split('.').map((n) => parseInt(n, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

function suggestBuild(version: string): string {
  const n = version
    .replace(/[^\d.]/g, '')
    .split('.')
    .reduce((acc, p) => acc * 10 + (parseInt(p, 10) || 0), 0)
  return String(1000 + (n % 9000))
}

/**
 * Mock “parse” after upload — no real APK inspection.
 */
export function mockParseFile(
  file: { name: string; size: number },
  application?: Application,
): ParsedArtifactFile {
  const kind = detectFileKind(file.name)
  const platform = platformFromKind(kind)
  const suggestedVersion = application ? bumpPatch(application.latestVersion) : '1.0.0'
  const fromName = file.name.match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/)
  const version = fromName?.[1] ?? suggestedVersion

  return {
    name: file.name,
    sizeBytes: file.size,
    kind,
    platform: platform ?? application?.platform ?? null,
    hash: mockHash(file.name, file.size),
    suggestedVersion: version,
    suggestedBuild: suggestBuild(version),
    suggestedPackageName: application?.packageName ?? '',
  }
}
