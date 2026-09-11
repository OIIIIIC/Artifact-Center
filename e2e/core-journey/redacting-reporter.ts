import type { Reporter, TestCase, TestError, TestResult } from '@playwright/test/reporter'

import { redactText } from './redaction.js'

function redactError(error: TestError | undefined) {
  if (!error) return
  if (error.message) error.message = redactText(error.message)
  if (error.stack) error.stack = redactText(error.stack)
  if (error.snippet) error.snippet = redactText(error.snippet)
  if (error.value) error.value = redactText(error.value)
  redactError(error.cause)
}

function redactOutput(entries: Array<string | Buffer>) {
  return entries.map((entry) =>
    typeof entry === 'string'
      ? redactText(entry)
      : Buffer.from(redactText(entry.toString('utf8'))),
  )
}

/**
 * This reporter runs before the list and JSON reporters. It is a final guard
 * for unexpected Playwright timeout/call-log text which may include a share
 * capability URL or typed password.
 */
class RedactingReporter implements Reporter {
  onTestEnd(_test: TestCase, result: TestResult) {
    redactError(result.error)
    for (const error of result.errors) redactError(error)
    for (const annotation of result.annotations) {
      if (annotation.description)
        annotation.description = redactText(annotation.description)
    }
    result.stdout = redactOutput(result.stdout)
    result.stderr = redactOutput(result.stderr)
  }

  onError(error: TestError) {
    redactError(error)
  }
}

export default RedactingReporter
