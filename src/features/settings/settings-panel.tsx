import type { ReactNode } from 'react'

import { FormStack } from '@/components/layout'

type SettingsPanelProps = {
  title: string
  description: string
  children: ReactNode
  wide?: boolean
  hideHeader?: boolean
}

/** 设置页各业务面板共用的标题与内容容器。 */
export function SettingsPanel({
  title,
  description,
  children,
  wide = false,
  hideHeader = false,
}: SettingsPanelProps) {
  return (
    <section className="w-full space-y-5">
      {!hideHeader ? (
        <div className="space-y-1">
          <h2 className="text-[1.0625rem] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      ) : null}
      {wide ? children : <FormStack>{children}</FormStack>}
    </section>
  )
}
