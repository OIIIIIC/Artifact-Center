import { Fragment, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MarkdownPreviewProps = {
  content: string
  className?: string
  empty?: ReactNode
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function inline(text: string, key: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*]+\*|_[^_]+_)/g
  const nodes: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    const token = match[0]
    const nodeKey = `${key}-${index}`
    if (token.startsWith('**')) {
      nodes.push(<strong key={nodeKey}>{inline(token.slice(2, -2), nodeKey)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={nodeKey}
          className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[0.8125em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token)
      const href = linkMatch ? safeHref(linkMatch[2]) : null
      nodes.push(
        href ? (
          <a
            key={nodeKey}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
          >
            {inline(linkMatch![1], nodeKey)}
          </a>
        ) : (
          token
        ),
      )
    } else {
      nodes.push(<em key={nodeKey}>{inline(token.slice(1, -1), nodeKey)}</em>)
    }
    cursor = pattern.lastIndex
    index += 1
  }

  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function splitTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isTableDivider(line: string): boolean {
  const cells = splitTableLine(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function startsBlock(line: string, nextLine?: string): boolean {
  return (
    /^```/.test(line) ||
    /^#{1,3}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    (line.includes('|') && Boolean(nextLine && isTableDivider(nextLine)))
  )
}

/** Render stored release notes without exposing Markdown HTML to the page. */
export function MarkdownPreview({ content, className, empty }: MarkdownPreviewProps) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    if (!line.trim()) {
      lineIndex += 1
      continue
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim()
      const code: string[] = []
      lineIndex += 1
      while (lineIndex < lines.length && !/^```/.test(lines[lineIndex])) {
        code.push(lines[lineIndex])
        lineIndex += 1
      }
      if (lineIndex < lines.length) lineIndex += 1
      blocks.push(
        <pre
          key={`code-${lineIndex}`}
          className="overflow-x-auto rounded-xl bg-muted/55 p-3 font-mono text-[0.75rem] leading-relaxed text-foreground"
        >
          {language ? (
            <code data-language={language}>{code.join('\n')}</code>
          ) : (
            code.join('\n')
          )}
        </pre>,
      )
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const classes =
        level === 1
          ? 'text-[1.125rem] font-semibold tracking-tight text-foreground'
          : level === 2
            ? 'text-[1rem] font-semibold tracking-tight text-foreground'
            : 'text-[0.9375rem] font-semibold text-foreground'
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      blocks.push(
        <Tag key={`heading-${lineIndex}`} className={classes}>
          {inline(heading[2], `heading-${lineIndex}`)}
        </Tag>,
      )
      lineIndex += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (lineIndex < lines.length && /^>\s?/.test(lines[lineIndex])) {
        quote.push(lines[lineIndex].replace(/^>\s?/, ''))
        lineIndex += 1
      }
      blocks.push(
        <blockquote
          key={`quote-${lineIndex}`}
          className="border-l-2 border-border-strong/70 pl-3 text-muted-foreground"
        >
          {quote.map((value, index) => (
            <Fragment key={index}>
              {inline(value, `quote-${lineIndex}-${index}`)}
              {index < quote.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </blockquote>,
      )
      continue
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${lineIndex}`} className="border-border/70" />)
      lineIndex += 1
      continue
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line)
    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line)
    if (unordered || ordered) {
      const orderedList = Boolean(ordered)
      const values: string[] = []
      const pattern = orderedList ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/
      while (lineIndex < lines.length) {
        const item = pattern.exec(lines[lineIndex])
        if (!item) break
        values.push(item[1])
        lineIndex += 1
      }
      const Tag = orderedList ? 'ol' : 'ul'
      blocks.push(
        <Tag
          key={`list-${lineIndex}`}
          className={cn('space-y-1 pl-5', orderedList ? 'list-decimal' : 'list-disc')}
        >
          {values.map((value, index) => (
            <li key={index}>{inline(value, `list-${lineIndex}-${index}`)}</li>
          ))}
        </Tag>,
      )
      continue
    }

    if (line.includes('|') && isTableDivider(lines[lineIndex + 1] ?? '')) {
      const headers = splitTableLine(line)
      lineIndex += 2
      const rows: string[][] = []
      while (
        lineIndex < lines.length &&
        lines[lineIndex].includes('|') &&
        lines[lineIndex].trim()
      ) {
        rows.push(splitTableLine(lines[lineIndex]))
        lineIndex += 1
      }
      blocks.push(
        <div
          key={`table-${lineIndex}`}
          className="overflow-x-auto rounded-xl ring-1 ring-border/60"
        >
          <table className="w-full min-w-max border-collapse text-left text-[0.8125rem]">
            <thead className="bg-muted/40 text-foreground">
              <tr>
                {headers.map((header, index) => (
                  <th key={index} className="px-3 py-2 font-medium">
                    {inline(header, `head-${lineIndex}-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-muted-foreground">
                      {inline(row[cellIndex] ?? '', `cell-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    const paragraph: string[] = [line]
    lineIndex += 1
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim() &&
      !startsBlock(lines[lineIndex], lines[lineIndex + 1])
    ) {
      paragraph.push(lines[lineIndex])
      lineIndex += 1
    }
    blocks.push(
      <p key={`paragraph-${lineIndex}`}>
        {paragraph.map((value, index) => (
          <Fragment key={index}>
            {inline(value, `paragraph-${lineIndex}-${index}`)}
            {index < paragraph.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    )
  }

  if (blocks.length === 0) return empty ? <>{empty}</> : null

  return (
    <div
      className={cn(
        'space-y-3 text-[0.8125rem] leading-relaxed text-muted-foreground',
        className,
      )}
    >
      {blocks}
    </div>
  )
}
