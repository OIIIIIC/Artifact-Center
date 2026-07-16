import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { MOCK_APPLICATIONS } from '@/mocks/applications'
import {
  detectFileKind,
  isEnabledKind,
  mockParseFile,
} from '@/features/upload/mock-parse'
import type { Application } from '@/types/application'
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

  const [step, setStep] = useState<UploadStep>(1)
  const [applicationId, setApplicationId] = useState(
    MOCK_APPLICATIONS.some((a) => a.id === presetApp) ? presetApp : '',
  )
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [fileError, setFileError] = useState<UploadFileError | null>(null)
  const [parsed, setParsed] = useState<ParsedArtifactFile | null>(null)
  const [version, setVersion] = useState<VersionDraft>(emptyVersion())
  const [publishError, setPublishError] = useState<PublishError>(null)
  const [publishing, setPublishing] = useState(false)
  const [done, setDone] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  const application: Application | undefined = useMemo(
    () => MOCK_APPLICATIONS.find((a) => a.id === applicationId),
    [applicationId],
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
  }, [])

  const processFile = useCallback((file: File, app?: Application) => {
    clearTimers()
    setFileError(null)
    setParsed(null)
    setPublishError(null)
    setDraftSaved(false)

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

    const t1 = window.setTimeout(() => setPhase('verifying'), 700)
    const t2 = window.setTimeout(() => setPhase('hashing'), 1400)
    const t3 = window.setTimeout(() => {
      const result = mockParseFile({ name: file.name, size: file.size }, app)
      // Platform mismatch mock: e.g. windows app + apk
      if (
        app &&
        result.platform &&
        app.platform !== 'zip' &&
        result.platform !== app.platform &&
        !(app.platform === 'android' && (result.kind === 'apk' || result.kind === 'aab'))
      ) {
        // Allow zip app any; android accepts apk/aab; otherwise flag wrong platform
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
    }, 2200)

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

  const goNext = useCallback(() => {
    if (!canNext) return
    if (step === 3) {
      // Surface duplicate as warning on review, still allow navigation
      if (application && version.version === application.latestVersion) {
        setPublishError('duplicate_version')
      } else {
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
    if (!application || !parsed) return
    setPublishing(true)
    setPublishError(null)

    await new Promise((r) => setTimeout(r, 900))

    if (version.version === application.latestVersion) {
      setPublishError('duplicate_version')
      setPublishing(false)
      return
    }

    setPublishing(false)
    setDone(true)
  }, [application, parsed, version.version])

  const saveDraft = useCallback(async () => {
    setPublishing(true)
    await new Promise((r) => setTimeout(r, 500))
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
  }
}
