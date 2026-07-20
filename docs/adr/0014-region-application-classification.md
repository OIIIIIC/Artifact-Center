# ADR-0014: Region 作为 Application 的可维护分类

- **状态**: accepted
- **日期**: 2026-07-20

实际交付按地域组织，同一软件可在多个地域形成独立的 Application 交付分支。Region 由管理员在设置中维护，每个 Application 必须绑定一个 Region；Region 只承担目录分类和交付范围识别，不进入一级导航，也不改变 Application 作为制品顶层归属对象的决策。

地域差异如果具有独立功能、版本或生命周期，应建立独立 Application，而不是把 Region 放在 Artifact 上。停用 Region 只阻止新绑定，不影响已有 Application 的历史归属。
