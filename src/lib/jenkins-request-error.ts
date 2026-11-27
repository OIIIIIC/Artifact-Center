import { ApiError } from '@/services/http'
import { getRequestErrorMessage } from './request-error'

/** Jenkins 上游故障不等同于 Artifact Center 不可用，保留后端给出的具体处理提示。 */
export function getJenkinsRequestErrorMessage(
  error: unknown,
  messages: Parameters<typeof getRequestErrorMessage>[1],
) {
  if (error instanceof ApiError && error.code.startsWith('jenkins_')) return error.message
  return getRequestErrorMessage(error, messages)
}
