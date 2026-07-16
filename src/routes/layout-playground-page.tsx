import { Box, Columns2, PanelLeft, Rows3, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AppLayout,
  BlankLayout,
  CenteredLayout,
  PageContainer,
  PageHeader,
  Section,
} from '@/components/layout'
import { EmptyState } from '@/components/feedback'
import { cn } from '@/lib/utils'

function PlaceholderBlock({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-16 items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/50 px-4 py-6 text-caption text-muted-foreground',
        className,
      )}
    >
      {label}
    </div>
  )
}

/**
 * Layout Playground — structure only, zero product domains.
 */
export function LayoutPlaygroundPage() {
  return (
    <AppLayout
      breadcrumbs={[{ label: 'Foundation', href: '/design-system' }, { label: 'Layout' }]}
    >
      <PageContainer className="space-y-[var(--section-gap)] pb-20">
        <PageHeader
          title="Layout Foundation"
          description="产品页面布局体系演示。仅展示壳层组合与节奏，不包含任何业务模块。"
          action={
            <Button type="button" variant="outline" size="sm">
              示例 Action
            </Button>
          }
        />

        <Section
          title="组合结构"
          description="AppLayout = Sidebar + Topbar + ContentArea；内容区统一 PageContainer → PageHeader → Section。"
        >
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="grid min-h-[280px] grid-cols-1 sm:grid-cols-[var(--sidebar-width)_1fr]">
              <div className="border-b border-border bg-sidebar p-4 sm:border-b-0 sm:border-r">
                <p className="text-label mb-3 text-muted-foreground">Sidebar</p>
                <div className="space-y-1.5">
                  <div className="rounded-md bg-sidebar-accent px-2.5 py-2 text-title">
                    Active item
                  </div>
                  <div className="rounded-md px-2.5 py-2 text-title text-muted-foreground">
                    Idle item
                  </div>
                  <div className="rounded-md px-2.5 py-2 text-title text-muted-foreground">
                    Idle item
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="flex h-[var(--topbar-height)] items-center border-b border-border px-4">
                  <p className="text-caption text-muted-foreground">
                    Topbar · Breadcrumb · Search · Theme · Avatar
                  </p>
                </div>
                <div className="flex-1 space-y-3 p-4">
                  <p className="text-caption text-muted-foreground">ContentArea</p>
                  <PlaceholderBlock label="PageContainer → PageHeader" />
                  <PlaceholderBlock label="Section · content" className="min-h-24" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="PageContainer"
          description="统一 max-width、左右 padding（--page-padding-x）、上下间距（--page-padding-y）。响应式 token 已内置。"
        >
          <div className="rounded-xl border border-border bg-surface p-1">
            <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted/40 px-[var(--page-padding-x)] py-[var(--page-padding-y)]">
              <p className="text-title text-foreground">Constrained content</p>
              <p className="text-caption mt-1 text-muted-foreground">
                max-width: var(--content-max-width) · padding 随断点变化
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PlaceholderBlock label="Card slot" className="min-h-20" />
                <PlaceholderBlock label="Card slot" className="min-h-20" />
                <PlaceholderBlock label="Card slot" className="min-h-20" />
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="PageHeader"
          description="仅 Title / Description / Action。禁止扩展为工具条或筛选栏。"
        >
          <Card>
            <CardContent className="pt-6">
              <PageHeader
                title="示例页面标题"
                description="一句话说明当前页面职责。保持克制，不堆次要操作。"
                action={<Button size="sm">Primary</Button>}
              />
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Section 节奏"
          description="页面内多块内容用 Section 分隔，标题层级统一为 H2。"
        >
          <div className="space-y-8">
            <Section title="第一区块" description="描述文本使用 caption 弱化。">
              <PlaceholderBlock label="Content A" />
            </Section>
            <Section
              title="第二区块"
              description="区块间距由页面 space-y-[section-gap] 控制。"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <PlaceholderBlock label="Content B1" />
                <PlaceholderBlock label="Content B2" />
              </div>
            </Section>
          </div>
        </Section>

        <Section
          title="Sidebar 规格"
          description="宽 256px · 分组导航 · 单色图标 · Active 为低对比 surface，非高饱和色。"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: PanelLeft, title: 'Width', body: '256px token' },
              { icon: Rows3, title: 'Groups', body: 'Label + items' },
              { icon: Box, title: 'Icons', body: 'Lucide mono' },
              { icon: Columns2, title: 'Collapse', body: 'API reserved' },
            ].map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" strokeWidth={1.75} />
                  </div>
                  <CardTitle className="text-title">{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          title="Topbar 白名单"
          description="允许：Breadcrumb · Search 占位 · Theme · Avatar 占位。禁止：统计、通知、消息、帮助。"
        >
          <ul className="grid gap-2 text-caption text-muted-foreground sm:grid-cols-2">
            <li className="rounded-lg border border-border bg-surface px-3 py-2">
              ✓ Breadcrumb
            </li>
            <li className="rounded-lg border border-border bg-surface px-3 py-2">
              ✓ Search placeholder
            </li>
            <li className="rounded-lg border border-border bg-surface px-3 py-2">
              ✓ Theme switch
            </li>
            <li className="rounded-lg border border-border bg-surface px-3 py-2">
              ✓ User avatar placeholder
            </li>
            <li className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              ✗ Stats / KPI
            </li>
            <li className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              ✗ Notifications / Help
            </li>
          </ul>
        </Section>

        <Section
          title="CenteredLayout"
          description="视口居中列，用于空状态与未来专注流（非业务实现）。"
        >
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="max-h-72 overflow-auto">
              <CenteredLayout className="min-h-72 py-10" maxWidthClassName="max-w-sm">
                <EmptyState
                  icon={Square}
                  title="居中布局示意"
                  description="Blank 内容区居中，不带 Sidebar / Topbar。"
                  action={
                    <Button type="button" size="sm" variant="secondary">
                      CTA
                    </Button>
                  }
                />
              </CenteredLayout>
            </div>
          </div>
        </Section>

        <Section
          title="BlankLayout"
          description="零壳层。全屏背景 + children，适合未来登录/向导外框（此处仅示意边框）。"
        >
          <div className="overflow-hidden rounded-xl border border-border">
            <BlankLayout className="min-h-40">
              <div className="flex min-h-40 items-center justify-center px-6">
                <p className="text-caption text-muted-foreground">
                  BlankLayout · no chrome · token background only
                </p>
              </div>
            </BlankLayout>
          </div>
        </Section>

        <Section
          title="响应式"
          description="Desktop 固定侧栏 · Laptop 同构 · Tablet/Mobile 抽屉导航（Topbar 菜单按钮）。"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Desktop', '≥1280 · rail 常显'],
              ['Laptop', '1024–1279 · rail 常显'],
              ['Tablet', '<1024 · 抽屉'],
              ['Mobile', '<640 · 抽屉 + 紧凑 Topbar'],
            ].map(([name, desc]) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                <p className="text-title text-foreground">{name}</p>
                <p className="text-caption mt-1 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </PageContainer>
    </AppLayout>
  )
}
