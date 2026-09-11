/** Pure domain registry shared by the API and browser; no server dependencies. */
export const APPLICATION_PLATFORMS = ['android', 'windows', 'linux'] as const
export type ApplicationPlatform = (typeof APPLICATION_PLATFORMS)[number]
export const ARTIFACT_TYPES = [
  'apk',
  'aab',
  'exe',
  'zip',
  'tar',
  'tar.gz',
  'deb',
  'rpm',
  'appimage',
] as const
export type ArtifactType = (typeof ARTIFACT_TYPES)[number]

export const ARTIFACT_REGISTRY: Record<
  ArtifactType,
  {
    platform: ApplicationPlatform
    extensions: readonly string[]
    label: string
  }
> = {
  apk: { platform: 'android', extensions: ['.apk'], label: 'APK' },
  aab: { platform: 'android', extensions: ['.aab'], label: 'AAB' },
  exe: { platform: 'windows', extensions: ['.exe', '.msi'], label: 'EXE / MSI' },
  zip: { platform: 'linux', extensions: ['.zip'], label: 'ZIP' },
  tar: { platform: 'linux', extensions: ['.tar'], label: 'TAR' },
  'tar.gz': { platform: 'linux', extensions: ['.tar.gz', '.tgz'], label: 'TAR.GZ / TGZ' },
  deb: { platform: 'linux', extensions: ['.deb'], label: 'DEB' },
  rpm: { platform: 'linux', extensions: ['.rpm'], label: 'RPM' },
  appimage: { platform: 'linux', extensions: ['.appimage'], label: 'AppImage' },
}

export function normalizePlatform(value: unknown): unknown {
  return value === 'zip' ? 'linux' : value
}

export function artifactExtension(filename: string): string | undefined {
  const name = filename.trim().toLowerCase()
  return ARTIFACT_TYPES.flatMap((kind) => ARTIFACT_REGISTRY[kind].extensions)
    .sort((left, right) => right.length - left.length)
    .find((extension) => name.endsWith(extension))
}

export function resolveArtifactType(filename: string): ArtifactType | null {
  const extension = artifactExtension(filename)
  return (
    ARTIFACT_TYPES.find((kind) =>
      ARTIFACT_REGISTRY[kind].extensions.includes(extension ?? ''),
    ) ?? null
  )
}

export function platformForArtifactType(type: ArtifactType): ApplicationPlatform {
  return ARTIFACT_REGISTRY[type].platform
}

export function acceptedArtifactExtensions(platform?: ApplicationPlatform): string {
  return ARTIFACT_TYPES.filter(
    (kind) => !platform || ARTIFACT_REGISTRY[kind].platform === platform,
  )
    .flatMap((kind) => ARTIFACT_REGISTRY[kind].extensions)
    .join(',')
}
