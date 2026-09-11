# ADR-0015: Share Collection 承载同地域多制品交付

- **状态**: accepted
- **日期**: 2026-07-20

> 2026-09-09：同地域范围随 [ADR-0019](0019-product-project-directory.md) 改称同产品范围，允许包含其多个项目的应用；分享令牌与选择规则不变。

## 背景

同一地域的现场交付通常需要多个 Application 的 APK。逐个创建并发送 Share Link，会让创建人重复操作，也迫使接收人逐个打开链接，无法形成一次完整交付。

## 决策

- Share Link 可以包含一个或多个 Share Item，并继续作为唯一的公开能力链接。
- 多项 Share Link 称为 Share Collection；所有 Share Item 必须属于同一 Region。
- 每个 Share Item 独立选择 `latest`（下载时解析最新版）或 `artifact`（固定制品）。
- 创建人必须对每个 Application 都拥有 maintainer 权限。
- 链接的过期与吊销作用于整个 Share Collection；下载次数按链接和分享项分别记录。
- 接收页展示完整清单并逐项下载。ZIP 聚合下载不进入本阶段。
- 现有单 Application Share Link 保持兼容，并作为只有一个 Share Item 的特殊情况。

### 应用活动关联（2026-09-11）

创建和吊销 Share Collection 各保留一条审计事件，事件快照保存全部 Application ID。各应用的活动流按当前应用权限读取相关事件，不应只依赖兼容字段中的首项 Application ID；在应用活动中展示当前应用名称，全局日志不重复生成多条事件。

历史创建事件按既有 `meta.applicationIds` 快照关联，缺少快照的旧吊销事件可通过仍存在的 Share Item 关联，不改写历史日志。新吊销事件补齐应用列表快照，以便分享删除后仍保留关联事实。创建和吊销成功后，前端使应用活动和全局日志缓存失效；日志刷新不阻塞链接复制。单纯再次复制现有链接不新增创建事件。

## 替代方案

- 批量创建多个链接：没有改善接收人的操作路径。
- 直接生成 ZIP：增加压缩耗时、临时空间和失败重试成本，且弱化单制品审计。
- 按 Region 动态包含所有 Application：链接内容会因后来新增 Application 而意外变化，权限和可预期性较差。

## 后果

- 创建人一次选择多个 Application，只发送一个链接。
- 接收人一次确认完整交付清单，并按需下载 APK。
- 数据库需要 Share Item 关系和新的迁移；公开解析与下载统一经过分享解析模块。
