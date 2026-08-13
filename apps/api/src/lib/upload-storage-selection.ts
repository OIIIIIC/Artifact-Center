export type UploadStorageSelection = {
  storageBackend: 'local' | 's3'
  storageKey: string
  objectUploadId: string | null
}

type SelectUploadStorageOptions = {
  objectStorageEnabled: boolean
  localStorageKey: string
  objectStorageKey: string
  createObjectMultipartUpload: () => Promise<string>
  onDirectUploadUnavailable?: (error: unknown) => void
}

/**
 * Prefer browser-direct object storage, but keep publishing available when the
 * object store is temporarily unavailable. Local chunk uploads already have
 * integrity validation and resumability, so they are a safe fallback.
 */
export async function selectUploadStorage({
  objectStorageEnabled,
  localStorageKey,
  objectStorageKey,
  createObjectMultipartUpload,
  onDirectUploadUnavailable,
}: SelectUploadStorageOptions): Promise<UploadStorageSelection> {
  if (!objectStorageEnabled) {
    return { storageBackend: 'local', storageKey: localStorageKey, objectUploadId: null }
  }

  try {
    return {
      storageBackend: 's3',
      storageKey: objectStorageKey,
      objectUploadId: await createObjectMultipartUpload(),
    }
  } catch (error) {
    onDirectUploadUnavailable?.(error)
    return { storageBackend: 'local', storageKey: localStorageKey, objectUploadId: null }
  }
}
