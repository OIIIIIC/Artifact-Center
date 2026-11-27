import { request } from '@/services/http'

export type JenkinsConnection = {
  id?: string
  name?: string
  baseUrl: string
  username: string
  enabled: boolean
  hasToken: boolean
  revision: number
  updatedAt: string
}
export type JenkinsConnectionInput = Pick<
  JenkinsConnection,
  'baseUrl' | 'username' | 'enabled' | 'revision'
> & { token?: string; id?: string; name?: string }
export type JenkinsSettings = {
  connection: JenkinsConnection | null
  connections?: JenkinsConnection[]
  keyReady: boolean
}
export type ApplicationBuildConfig = {
  connectionId?: string
  enabled: boolean
  jobPath: string
  artifactPattern: string
  outputTargets?: Array<{ name: string; pattern: string; applicationId: string }>
  parameters: Array<{ name: string; value: string }>
  parameterChoices?: Array<{ name: string; choices: string[] }>
  revision: number
}
export type ApplicationBuildSettings = {
  config: ApplicationBuildConfig | null
  connectionReady: boolean
  keyReady?: boolean
  connections?: Array<{ id: string; name: string; enabled: boolean }>
}
export const jenkinsKeys = {
  connection: ['jenkins-connection'] as const,
  applications: ['application-build-config'] as const,
  application: (id: string) => ['application-build-config', id] as const,
}
export const apiGetJenkinsSettings = () => request<JenkinsSettings>('/settings/jenkins')
const connectionPath = (id?: string) =>
  id && id !== 'default'
    ? `/settings/jenkins/connections/${encodeURIComponent(id)}`
    : '/settings/jenkins'
export const apiSaveJenkinsSettings = ({ id, ...body }: JenkinsConnectionInput) =>
  request<JenkinsSettings>(connectionPath(id), { method: 'PUT', body })
export const apiTestJenkinsSettings = ({ id, ...body }: JenkinsConnectionInput) =>
  request<{ ok: true; version: string }>(`${connectionPath(id)}/test`, {
    method: 'POST',
    body,
  })
const buildPath = (id: string) => `/applications/${encodeURIComponent(id)}/build-config`
// Read/save responses can contain database metadata; send only the editable API contract.
function buildConfigInput(config: ApplicationBuildConfig): ApplicationBuildConfig {
  return {
    ...(config.connectionId ? { connectionId: config.connectionId } : {}),
    enabled: config.enabled,
    jobPath: config.jobPath,
    artifactPattern: config.artifactPattern,
    parameters: config.parameters.map(({ name, value }) => ({ name, value })),
    outputTargets: (config.outputTargets ?? []).map(
      ({ name, pattern, applicationId }) => ({
        name,
        pattern,
        applicationId,
      }),
    ),
    revision: config.revision,
  }
}
export const apiGetApplicationBuildConfig = (id: string) =>
  request<ApplicationBuildSettings>(buildPath(id))
export const apiSaveApplicationBuildConfig = (id: string, body: ApplicationBuildConfig) =>
  request<{ config: ApplicationBuildConfig }>(buildPath(id), {
    method: 'PUT',
    body: buildConfigInput(body),
  })
export const apiTestApplicationBuildConfig = (id: string, body: ApplicationBuildConfig) =>
  request<{
    ok: true
    fullName: string
    parameters: Array<{ name: string; type: string; choices?: string[] }>
  }>(`${buildPath(id)}/test`, { method: 'POST', body: buildConfigInput(body) })
