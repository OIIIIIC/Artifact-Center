# ADR-0004: 基于对象的导航模型

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (AGENTS.md §6, 01-PRD.md §5)

## 背景

传统后台管理系统常以功能动作(上传、下载、统计、日志)作为导航结构，导致用户认知负担重。Artifact Center 需要为开发/测试/产品/运维等多种角色提供直觉式导航。

## 决策

导航结构**基于产品对象而非动作**。

正确示范：

```
Applications  →  具体应用  →  Overview / Artifacts / Release Notes / Settings
Settings
```

错误示范：

```
Upload / Download / Release / Dashboard / Statistics / Logs / Reports
```

主导航只包含 `Applications` 和 `Settings`。次级导航(App 详情内)始终归属于父对象。

判定标准：每个页面必须能回答 "What object am I currently looking at?"

## 替代方案

- **功能导向导航**: 传统后台风格，每个功能独立菜单项。违反产品圣经的设计原则，会退化为 ERP 风格。
- **混合导航**: 部分对象+部分动作。语义混乱，AI 和用户均难理解当前上下文。

## 后果

- **正面**: 用户直觉理解"我在看什么"，降低认知负担；AI 助手能基于对象路由准确理解任务意图
- **负面**: 新功能必须先确定归属对象，增加设计讨论成本
- **约束**: 未来新增功能必须符合对象归属原则，否则应质疑其必要性
