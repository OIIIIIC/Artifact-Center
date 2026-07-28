/** 在非安全内网 HTTP 环境中，Clipboard API 可能不可用，需要退回到选区复制。 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return copyTextFallback(text)
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyTextFallback(text)
  }
}

function copyTextFallback(text: string): boolean {
  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  const selection = document.getSelection()
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
    if (previousRange && selection) {
      selection.removeAllRanges()
      selection.addRange(previousRange)
    }
  }
}
