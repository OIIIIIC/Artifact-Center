import { SignJWT, jwtVerify } from 'jose'

import { env } from '../env.js'

const secret = new TextEncoder().encode(env.jwtSecret)

export type AccessTokenPayload = {
  sub: string
  email: string
  name: string
  role: string
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  expiresIn = '7d',
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret)
  const sub = payload.sub
  if (!sub || typeof payload.email !== 'string' || typeof payload.name !== 'string') {
    throw new Error('invalid_token')
  }
  return {
    sub,
    email: payload.email,
    name: payload.name,
    role: String(payload.role ?? 'viewer'),
  }
}
