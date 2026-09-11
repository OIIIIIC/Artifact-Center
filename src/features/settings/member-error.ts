import type { TFunction } from 'i18next'
import { ApiError, isConnectivityError } from '@/services/http'
import { getRequestErrorMessage } from '@/lib/request-error'

export function getMemberErrorMessage(error: unknown, t: TFunction) {
  if (isConnectivityError(error))
    return getRequestErrorMessage(error, {
      offline: t('common.requestFailedOffline'),
      unavailable: t('common.requestFailedUnavailable'),
      fallback: t('settings.memberErrorGeneric'),
    })
  if (error instanceof ApiError) {
    const key = {
      email_taken: 'settings.memberErrorDuplicate',
      username_taken: 'settings.memberErrorDuplicate',
      last_admin: 'settings.memberErrorLastAdmin',
      cannot_delete_self: 'settings.memberErrorSelfDelete',
      self_role_change_requires_transfer: 'settings.memberErrorSelfRoleChange',
      transfer_target_not_found: 'settings.memberErrorTransferTarget',
      transfer_target_inactive: 'settings.memberErrorTransferTargetInactive',
      weak_password: 'settings.passwordErrorWeak',
      not_found: 'settings.memberErrorNotFound',
      forbidden: 'settings.resetForbidden',
      invalid_body: 'settings.memberErrorEmpty',
    }[error.code]
    return key ? t(key) : error.message || t('settings.memberErrorGeneric')
  }
  return t('settings.memberErrorGeneric')
}
