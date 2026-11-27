import { SignJWT, jwtVerify } from 'jose'

import { env } from '../env.js'

const secret = new TextEncoder().encode(env.jwtSecret)

export type AccessTokenPayload = {
  sub: string
  email: string
  name: string
  role: string
  tokenVersion: number
}

export type DownloadTicketPayload = AccessTokenPayload & {
  artifactId: string
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn = '7d',
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  // 专用下载票据不能作为通用登录令牌使用。
  if (payload.aud !== undefined) throw new Error('invalid_token_audience')
  const sub = payload.sub
  if (
    !sub ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    !Number.isInteger(payload.tokenVersion) ||
    (payload.tokenVersion as number) < 0
  ) {
    throw new Error('invalid_token')
  }
  return {
    sub,
    email: payload.email,
    name: payload.name,
    role: String(payload.role ?? 'viewer'),
    tokenVersion: payload.tokenVersion as number,
  }
}

/** 短时下载凭据仅用于浏览器原生下载，不能作为登录凭据使用。 */
export async function signDownloadTicket(
  payload: DownloadTicketPayload,
  expiresIn = '60s',
): Promise<string> {
  return new SignJWT({
    artifactId: payload.artifactId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setAudience('artifact-download')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyDownloadTicket(
  token: string,
): Promise<DownloadTicketPayload> {
  const { payload } = await jwtVerify(token, secret, { audience: 'artifact-download' })
  const sub = payload.sub
  if (
    !sub ||
    typeof payload.artifactId !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    !Number.isInteger(payload.tokenVersion) ||
    (payload.tokenVersion as number) < 0
  ) {
    throw new Error('invalid_download_ticket')
  }
  return {
    sub,
    artifactId: payload.artifactId,
    email: payload.email,
    name: payload.name,
    role: String(payload.role ?? 'viewer'),
    tokenVersion: payload.tokenVersion as number,
  }
}

export type BuildDownloadTicket = AccessTokenPayload & {
  buildId: string
  relativePath: string
}
export async function signBuildDownloadTicket(payload: BuildDownloadTicket) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setAudience('jenkins-build-download')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(secret)
}
export async function verifyBuildDownloadTicket(
  token: string,
): Promise<BuildDownloadTicket> {
  const { payload } = await jwtVerify(token, secret, {
    audience: 'jenkins-build-download',
  })
  if (
    !payload.sub ||
    typeof payload.buildId !== 'string' ||
    typeof payload.relativePath !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.name !== 'string' ||
    !Number.isInteger(payload.tokenVersion)
  )
    throw new Error('invalid_build_ticket')
  return {
    sub: payload.sub,
    buildId: payload.buildId,
    relativePath: payload.relativePath,
    email: payload.email,
    name: payload.name,
    role: String(payload.role ?? 'viewer'),
    tokenVersion: payload.tokenVersion as number,
  }
}
