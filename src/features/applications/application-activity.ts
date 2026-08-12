import type { Application } from '@/types/application'

export type TimelineBucket = 'today' | 'week' | 'month' | 'older' | 'unpublished'

export type TimelineGroup = {
  bucket: TimelineBucket
  applications: Application[]
}

const DAY = 24 * 60 * 60 * 1000
const BUCKETS: TimelineBucket[] = ['today', 'week', 'month', 'older', 'unpublished']

/** Group catalogue entries around the last artifact activity, newest first. */
export function groupApplicationsByActivity(
  applications: Application[],
  now = Date.now(),
): TimelineGroup[] {
  const groups = new Map<TimelineBucket, Application[]>(
    BUCKETS.map((bucket) => [bucket, []]),
  )

  for (const application of applications) {
    if (application.artifactCount <= 0) {
      groups.get('unpublished')!.push(application)
      continue
    }

    const uploadedAt = new Date(application.latestArtifactUploadedAt ?? '').getTime()
    const age = Number.isNaN(uploadedAt)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, now - uploadedAt)
    const bucket: TimelineBucket =
      age < DAY ? 'today' : age < 7 * DAY ? 'week' : age < 30 * DAY ? 'month' : 'older'
    groups.get(bucket)!.push(application)
  }

  return BUCKETS.map((bucket) => ({ bucket, applications: groups.get(bucket)! })).filter(
    (group) => group.applications.length > 0,
  )
}
