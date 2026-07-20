import type { Context } from 'hono'

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** API 错误码是稳定契约，返回文案统一使用中文，前端可按 code 做细分交互。 */
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: '登录状态无效或已过期',
  forbidden: '没有执行此操作的权限',
  not_found: '请求的资源不存在',
  invalid_body: '请求参数不正确',
  invalid_query: '查询参数不正确',
  invalid_credentials: '邮箱或密码不正确',
  wrong_password: '当前密码不正确',
  weak_password: '密码强度不足',
  same_as_current: '新密码不能与当前密码相同',
  email_taken: '该邮箱已被使用',
  file_required: '请选择要上传的文件',
  empty_file: '上传文件不能为空',
  too_large: '上传文件超过大小限制',
  unsupported_file_type: '不支持该文件类型',
  platform_mismatch: '文件类型与应用平台不一致',
  duplicate_artifact: '该版本、文件类型和构建号的制品已存在',
  file_missing: '制品文件不存在或已被清理',
  app_missing: '应用已不存在',
  artifact_missing: '制品已不存在',
  archived_artifact: '已归档制品不能创建新的固定版本分享',
  archived_application: '应用已归档，请先恢复应用状态后再执行此操作',
  revoked: '分享链接已被吊销',
  expired: '分享链接已过期',
  last_admin: '系统至少需要保留一名管理员',
  cannot_delete_self: '不能删除当前登录用户',
  owner_membership_required: '应用所有者必须保留成员身份',
  platform_role_insufficient: '只读平台账号不能设置为应用维护者',
  region_in_use: '该地域仍被应用绑定，无法删除',
  internal_error: '服务器处理请求时发生错误',
}

export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: {
      code,
      message: ERROR_MESSAGES[code] ?? message,
      ...(details !== undefined ? { details } : {}),
    },
  }
  return c.json(body, status as 400)
}
