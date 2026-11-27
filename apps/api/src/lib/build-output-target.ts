import type { BuildOutputTarget } from '../db/schema.js'
import { matchesArtifactPattern } from './jenkins-build-client.js'
import { JenkinsError } from './jenkins.js'

export function resolveBuildOutputTarget(
  run: { applicationId: string; outputTargets?: BuildOutputTarget[] },
  relativePath: string,
) {
  if (!run.outputTargets?.length) return { applicationId: run.applicationId, name: '' }
  const matches = run.outputTargets.filter((target) =>
    matchesArtifactPattern(relativePath, target.pattern),
  )
  if (matches.length !== 1)
    throw new JenkinsError(
      'jenkins_output_target_ambiguous',
      '产物未匹配唯一发布目标，请管理员检查产物规则后重新构建',
      409,
    )
  return matches[0]
}
