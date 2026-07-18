import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useApplicationCatalog } from '@/features/applications/use-applications'
import {
  detectFileKind,
  isEnabledKind,
  mockParseFile,
} from '@/features/upload/mock-parse'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/services/http'
import { apiListArtifacts, apiUploadArtifact } from '@/services/api'
import type { Application, ApplicationPlatform } from '@/types/application'
import type {
  ParsedArtifactFile,
  PublishError,
  UploadChannel,
  UploadFileError,
  UploadPhase,
  UploadStep,
  VersionDraft,
} from '@/types/upload'
import { UPLOAD_MAX_BYTES } from '@/types/upload'

function emptyVersion(): VersionDraft {
  return {
    version: '',
    buildNumber: '',
    packageName: '',
    platform: '',
    channel: 'stable',
    releaseNotes: '',
    markLatest: true,
  }
}

export function useUploadFlow() {
  const [params] = useSearchParams()
  const presetApp = params.get('app') ?? ''
  const queryClient = useQueryClient()
  const { catalog, loading: catalogLoading } = useApplicationCatalog()

  /** Deep-link from detail (?app=) skips application pick when id is known. */
  const [step, setStep] = useState<UploadStep>(() => (presetApp ? 2 : 1))
  const [applicationId, setApplicationId] = useState(presetApp)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [fileError, setFileError] = useState<UploadFileError | null>(null)
  const [parsed, setParsed] = useState<ParsedArtifactFile | null>(null)
  const [version, setVersion] = useState<VersionDraft>(emptyVersion())
  const [publishError, setPublishError] = useState<PublishError>(null)
  const [publishing, setPublishing] = useState(false)
  const [done, setDone] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const timers = useRef<number[]>([])
  /** Keep real File for multipart upload */
  const fileRef = useRef<File | null>(null)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  const application: Application | undefined = useMemo(
    () => (applicationId ? catalog.find((a) => a.id === applicationId) : undefined),
    [applicationId, catalog],
  )

  const selectApplication = useCallback((id: string) => {
    setApplicationId(id)
    setFileError(null)
    setPublishError(null)
  }, [])

  const resetFile = useCallback(() => {
    clearTimers()
    setPhase('idle')
    setFileError(null)
    setParsed(null)
    fileRef.current = null
  }, [])

  const processFile = useCallback((file: File, app?: Application) => {
    clearTimers()
    setFileError(null)
    setParsed(null)
    setPublishError(null)
    setDraftSaved(false)
    fileRef.current = file

    if (!file || file.size === 0) {
      setPhase('error')
      setFileError('empty')
      return
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      setPhase('error')
      setFileError('too_large')
      return
    }

    const kind = detectFileKind(file.name)
    if (!isEnabledKind(kind)) {
      setPhase('error')
      setFileError(kind === 'unknown' ? 'unsupported' : 'wrong_platform')
      return
    }

    setPhase('uploading')

    const t1 = window.setTimeout(() => setPhase('verifying'), 400)
    const t2 = window.setTimeout(() => setPhase('hashing'), 800)
    const t3 = window.setTimeout(() => {
      const result = mockParseFile({ name: file.name, size: file.size }, app)
      if (
        app &&
        result.platform &&
        app.platform !== 'zip' &&
        result.platform !== app.platform &&
        !(app.platform === 'android' && (result.kind === 'apk' || result.kind === 'aab'))
      ) {
        if (
          (app.platform === 'windows' && result.platform !== 'windows') ||
          (app.platform === 'android' && result.platform !== 'android')
        ) {
          setPhase('error')
          setFileError('wrong_platform')
          setParsed(result)
          return
        }
      }

      setParsed(result)
      setVersion({
        version: result.suggestedVersion,
        buildNumber: result.suggestedBuild,
        packageName: result.suggestedPackageName || app?.packageName || '',
        platform: result.platform ?? app?.platform ?? '',
        channel: 'stable',
        releaseNotes: '',
        markLatest: true,
      })
      setPhase('ready')
    }, 1200)

    timers.current = [t1, t2, t3]
  }, [])

  const canNext = useMemo(() => {
    if (step === 1) return Boolean(applicationId)
    if (step === 2) return phase === 'ready' && parsed && !fileError
    if (step === 3) {
      return (
        Boolean(version.version.trim()) &&
        Boolean(version.buildNumber.trim()) &&
        Boolean(version.platform)
      )
    }
    return true
  }, [step, applicationId, phase, parsed, fileError, version])

  const goNext = useCallback(async () => {
    if (!canNext) return
    if (step === 3 && application) {
      try {
        const existing = await apiListArtifacts(application.id)
        const dup = existing.some((a) => a.version === version.version.trim())
        setPublishError(dup ? 'duplicate_version' : null)
      } catch {
        setPublishError(null)
      }
    }
    if (step < 4) setStep((s) => (s + 1) as UploadStep)
  }, [canNext, step, application, version.version])

  const goBack = useCallback(() => {
    setPublishError(null)
    setDraftSaved(false)
    if (step > 1) setStep((s) => (s - 1) as UploadStep)
  }, [step])

  const updateVersion = useCallback((patch: Partial<VersionDraft>) => {
    setVersion((v) => ({ ...v, ...patch }))
    setPublishError(null)
    setDraftSaved(false)
  }, [])

  const setChannel = useCallback((channel: UploadChannel) => {
    setVersion((v) => ({ ...v, channel }))
  }, [])

  const publish = useCallback(async () => {
    if (!application || !parsed || !fileRef.current) return
    setPublishing(true)
    setPublishError(null)

    const platform = (version.platform ||
      parsed.platform ||
      application.platform) as ApplicationPlatform

    try {
      await apiUploadArtifact(application.id, fileRef.current, {
        version: version.version.trim(),
        buildNumber: version.buildNumber.trim(),
        platform,
        channel: version.channel,
        releaseNotes: version.releaseNotes,
        markLatest: version.markLatest,
      })

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.artifacts.byApp(application.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.applications.detail(application.id),
        }),
      ])

      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_version') {
        setPublishError('duplicate_version')
      } else {
        setPublishError('upload_failed')
      }
    } finally {
      setPublishing(false)
    }
  }, [application, parsed, version, queryClient])

  const saveDraft = useCallback(async () => {
    setPublishing(true)
    await new Promise((r) => setTimeout(r, 300))
    setPublishing(false)
    setDraftSaved(true)
  }, [])

  const resetAll = useCallback(() => {
    clearTimers()
    setStep(1)
    setApplicationId('')
    setPhase('idle')
    setFileError(null)
    setParsed(null)
    setVersion(emptyVersion())
    setPublishError(null)
    setPublishing(false)
    setDone(false)
    setDraftSaved(false)
    fileRef.current = null
  }, [])

  return {
    step,
    setStep,
    applicationId,
    application,
    selectApplication,
    phase,
    fileError,
    parsed,
    processFile,
    resetFile,
    version,
    updateVersion,
    setChannel,
    canNext,
    goNext,
    goBack,
    publish,
    saveDraft,
    publishing,
    publishError,
    done,
    draftSaved,
    resetAll,
    catalogLoading,
  }
}
