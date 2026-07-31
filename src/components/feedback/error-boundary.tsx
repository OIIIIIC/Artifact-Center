import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 捕获渲染阶段的未处理异常，避免用户只看到空白页面。
 * 该边界位于全局 Provider 之外，因此回退界面不依赖应用运行时状态。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error-boundary] 页面渲染失败', error, info)
  }

  private reload = () => {
    globalThis.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main
        role="alert"
        aria-live="assertive"
        className="flex min-h-dvh items-center justify-center bg-background px-6 py-12 text-foreground"
      >
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <TriangleAlert className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">页面暂时无法显示</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Artifact Center
            遇到了未预期的问题。刷新页面通常可以恢复；如果问题持续，请将发生时间告知管理员。
          </p>
          {import.meta.env.DEV ? (
            <details className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                开发错误详情
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono">
                {this.state.error.message}
              </pre>
            </details>
          ) : null}
          <button
            type="button"
            onClick={this.reload}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="size-4" aria-hidden />
            刷新页面
          </button>
        </section>
      </main>
    )
  }
}
