import { motion } from 'framer-motion'
import { Inbox, Loader2, Moon, Monitor, Sun } from 'lucide-react'

import { PageContainer, Section, StatusBadge } from '@/components/common'
import { EmptyState, Loading, PageSkeleton } from '@/components/feedback'
import { AppLayout } from '@/components/layout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  colorTokens,
  motionTokens,
  radiusTokens,
  spacingTokens,
  type TypographyToken,
} from '@/lib/tokens'
import { useThemeStore } from '@/store/theme-store'
import type { ThemeMode } from '@/types/theme'

const typographySamples: { token: TypographyToken; className: string }[] = [
  { token: 'display', className: 'text-display' },
  { token: 'h1', className: 'text-h1' },
  { token: 'h2', className: 'text-h2' },
  { token: 'h3', className: 'text-h3' },
  { token: 'title', className: 'text-title' },
  { token: 'body', className: 'text-body' },
  { token: 'caption', className: 'text-caption' },
  { token: 'label', className: 'text-label' },
  { token: 'code', className: 'text-code' },
]

const colorVarMap: Record<(typeof colorTokens)[number], string> = {
  background: 'var(--background)',
  surface: 'var(--surface)',
  'surface-muted': 'var(--surface-muted)',
  foreground: 'var(--foreground)',
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  muted: 'var(--muted)',
  border: 'var(--border)',
  'border-strong': 'var(--border-strong)',
  ring: 'var(--ring)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  info: 'var(--info)',
}

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const navItems = [
  'Typography',
  'Color',
  'Spacing',
  'Button',
  'Card',
  'Input',
  'Badge',
  'Theme',
  'Motion',
  'Empty State',
  'Skeleton',
  'Loading',
] as const

function anchorId(label: string) {
  return label.toLowerCase().replace(/\s+/g, '-')
}

export function DesignSystemPage() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  return (
    <AppLayout
      title="Design System"
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={theme === value ? 'default' : 'ghost'}
              className="h-7 gap-1.5 px-2"
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
      }
    >
      <PageContainer className="space-y-[var(--section-gap)] pb-24">
        <header className="space-y-3 max-w-2xl">
          <p className="text-caption text-muted-foreground tracking-wide uppercase">
            Artifact Center · Foundation
          </p>
          <h1 className="text-display text-foreground">Design System</h1>
          <p className="text-body text-muted-foreground">
            本页是工程阶段唯一允许的页面，用于展示与校验 Design Token
            与基础组件。不包含任何业务能力。规范来源：docs/02、07、08。
          </p>
        </header>

        <nav
          aria-label="Design system sections"
          className="flex flex-wrap gap-2 border-y border-border py-4"
        >
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${anchorId(item)}`}
              className="text-caption rounded-md border border-border bg-surface px-2.5 py-1.5 text-muted-foreground transition-colors duration-hover hover:border-border-strong hover:text-foreground"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Typography */}
        <Section
          id={anchorId('Typography')}
          title="Typography"
          description="Display → Code。页面标题必须有存在感；正文 ≥ 14px。"
        >
          <Card>
            <CardContent className="space-y-5 pt-6">
              {typographySamples.map(({ token, className }) => (
                <div
                  key={token}
                  className="flex flex-col gap-1 border-b border-border pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-6"
                >
                  <code className="text-code w-24 shrink-0 text-muted-foreground">
                    {token}
                  </code>
                  <p className={`${className} text-foreground`}>
                    Artifact Center — 制品管理
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        {/* Color */}
        <Section
          id={anchorId('Color')}
          title="Color"
          description="中性色主导 + 单一 Primary（Strategy A 近黑）。状态色仅表达语义。"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colorTokens.map((token) => (
              <div
                key={token}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div
                  className="size-10 shrink-0 rounded-lg border border-border"
                  style={{ background: colorVarMap[token] }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-title text-foreground">{token}</p>
                  <p className="text-caption text-muted-foreground truncate">
                    {colorVarMap[token]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Spacing */}
        <Section
          id={anchorId('Spacing')}
          title="Spacing"
          description="4px 网格。Large Spacing：宁可少显示几行，也不压缩呼吸感。"
        >
          <Card>
            <CardContent className="space-y-3 pt-6">
              {Object.entries(spacingTokens).map(([key, px]) => (
                <div key={key} className="flex items-center gap-4">
                  <code className="text-code w-16 text-muted-foreground">
                    {key} · {px}px
                  </code>
                  <div
                    className="h-3 rounded-sm bg-primary/80"
                    style={{ width: px }}
                    aria-hidden
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>

        {/* Button */}
        <Section
          id={anchorId('Button')}
          title="Button"
          description="每区最多一个 Primary。Danger 仅用于破坏性确认。"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
            <Button>
              <Loader2 className="animate-spin" />
              Loading
            </Button>
          </div>
        </Section>

        {/* Card */}
        <Section
          id={anchorId('Card')}
          title="Card"
          description="边框优先、留白充分、字段克制。Hover 靠边框/背景，不靠重阴影。"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="transition-colors duration-hover hover:bg-surface-muted/40">
              <CardHeader>
                <CardTitle>Project card</CardTitle>
                <CardDescription>对象摘要 · 点击进入详情（示意）</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <span className="text-caption text-muted-foreground">
                  Updated just now
                </span>
                <StatusBadge status="success">active</StatusBadge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Artifact meta</CardTitle>
                <CardDescription>决策字段 ≤ 6 · 其余进详情</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-caption text-muted-foreground">
                <p>Type · APK</p>
                <p>Version · 1.2.3</p>
                <p className="text-code text-foreground">sha256: a1b2…f9</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Input */}
        <Section
          id={anchorId('Input')}
          title="Input"
          description="Label 在上；Focus ring 清晰；错误走边框 + 文案。"
        >
          <div className="grid max-w-md gap-4">
            <label className="space-y-1.5">
              <span className="text-label text-foreground">Version name</span>
              <Input placeholder="1.0.0" defaultValue="1.2.3" />
            </label>
            <label className="space-y-1.5">
              <span className="text-label text-foreground">Invalid example</span>
              <Input aria-invalid placeholder="required" />
              <span className="text-caption text-destructive">请填写版本号</span>
            </label>
            <label className="space-y-1.5">
              <span className="text-label text-foreground">Disabled</span>
              <Input disabled placeholder="不可用" />
            </label>
          </div>
        </Section>

        {/* Badge */}
        <Section
          id={anchorId('Badge')}
          title="Badge"
          description="中性优先；状态用浅底语义色。同行徽章 ≤ 3。"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <StatusBadge status="success">success</StatusBadge>
            <StatusBadge status="warning">warning</StatusBadge>
            <StatusBadge status="danger">danger</StatusBadge>
            <StatusBadge status="info">info</StatusBadge>
            <StatusBadge status="muted">muted</StatusBadge>
            <Avatar size="sm">
              <AvatarFallback>AC</AvatarFallback>
            </Avatar>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">
                  Tooltip
                </Button>
              </TooltipTrigger>
              <TooltipContent>Calm, professional tooltip</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        {/* Theme */}
        <Section
          id={anchorId('Theme')}
          title="Theme"
          description="Light / Dark / System。Dark 是重新设计的 Surface 层级，不是反相。"
        >
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-6">
              {themeOptions.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={theme === value ? 'default' : 'outline'}
                  onClick={() => setTheme(value)}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
              <p className="w-full text-caption text-muted-foreground">
                当前选择：<span className="text-foreground">{theme}</span>
                。切换后 documentElement 挂载 <code className="text-code">.dark</code>。
              </p>
            </CardContent>
          </Card>
        </Section>

        {/* Motion */}
        <Section
          id={anchorId('Motion')}
          title="Motion"
          description={`Hover ${motionTokens.hover}ms · Page ${motionTokens.page}ms · Modal ${motionTokens.modal}ms。禁止 Bounce / Elastic。`}
        >
          <div className="flex flex-wrap gap-4">
            <motion.div
              className="rounded-xl border border-border bg-surface px-6 py-8 text-title"
              whileHover={{ y: -2 }}
              transition={{ duration: motionTokens.hover / 1000, ease: [0.2, 0, 0, 1] }}
            >
              Hover · {motionTokens.hover}ms
            </motion.div>
            <motion.div
              className="rounded-xl border border-border bg-surface px-6 py-8 text-title"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.page / 1000, ease: [0.2, 0, 0, 1] }}
            >
              Enter · {motionTokens.page}ms
            </motion.div>
            <div className="rounded-xl border border-border bg-surface px-6 py-8 text-caption text-muted-foreground">
              Radius: sm {radiusTokens.sm} · md {radiusTokens.md} · lg {radiusTokens.lg} ·
              xl {radiusTokens.xl}
            </div>
          </div>
        </Section>

        {/* Empty State */}
        <Section
          id={anchorId('Empty State')}
          title="Empty State"
          description="图标 + 标题 + 描述 + 单一 CTA。"
        >
          <EmptyState
            icon={Inbox}
            title="还没有内容"
            description="这是空状态示意。业务数据接入后，在此引导用户完成首个操作。"
            action={<Button>主操作</Button>}
          />
        </Section>

        {/* Skeleton */}
        <Section
          id={anchorId('Skeleton')}
          title="Skeleton"
          description="与最终布局同构；列表 3–8 行即可。"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <PageSkeleton rows={3} />
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <div className="flex gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Loading */}
        <Section
          id={anchorId('Loading')}
          title="Loading"
          description="Spinner 仅用于局部忙碌；整页优先骨架。"
        >
          <Card>
            <CardContent className="py-12">
              <Loading />
            </CardContent>
          </Card>
        </Section>
      </PageContainer>
    </AppLayout>
  )
}
