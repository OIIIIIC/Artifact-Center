# ADR-0015: Share Collection 承载同地域多制品交付

- **状态**: accepted
- **日期**: 2026-07-20

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

## 替代方案

- 批量创建多个链接：没有改善接收人的操作路径。
- 直接生成 ZIP：增加压缩耗时、临时空间和失败重试成本，且弱化单制品审计。
- 按 Region 动态包含所有 Application：链接内容会因后来新增 Application 而意外变化，权限和可预期性较差。

## 后果

- 创建人一次选择多个 Application，只发送一个链接。
- 接收人一次确认完整交付清单，并按需下载 APK。
- 数据库需要 Share Item 关系和新的迁移；公开解析与下载统一经过分享解析模块。
