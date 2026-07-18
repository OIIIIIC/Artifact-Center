/** 生成同时兼容 ASCII 与 UTF-8 文件名的下载响应头。 */
export function attachmentDisposition(filename: string): string {
  const fallback =
    filename
      .normalize('NFKD')
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '_') || 'download'
  const encoded = encodeURIComponent(filename).replace(
    /['()]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
