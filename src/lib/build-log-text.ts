const escape = String.fromCharCode(27)
const consoleNote = new RegExp(`${escape}\\[8mha:[\\s\\S]*?${escape}\\[0m`, 'g')
const pendingConsoleNote = new RegExp(`${escape}\\[8mha:[\\s\\S]*$`)
const terminalControl = new RegExp(`${escape}\\[[0-?]*[ -/]*[@-~]`, 'g')

/** Remove Jenkins metadata and terminal formatting; never interpret log HTML. */
export function buildLogText(raw: string): string {
  return raw
    .replace(consoleNote, '')
    .replace(pendingConsoleNote, '')
    .replace(terminalControl, '')
}
