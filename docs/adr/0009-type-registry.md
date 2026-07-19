# ADR-0009: Type Registry 制品类型可插拔扩展

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (03-ARCHITECTURE.md §6, 01-PRD.md §3.3)

## 背景

Artifact Center MVP 支持 4 种制品类型(APK/AAB/EXE/ZIP)，远期需扩展 IPA、Firmware、Docker Image 等。每种类型有不同的扩展名、解析逻辑和详情展示需求。硬编码 `switch` 会导致核心流程随类型膨胀。

## 决策

采用 **Type Registry** 模式：

```
TypeRegistry:
  type: "apk"
  extensions: [".apk"]
  parser: ApkParser?     # 可选异步解析器
  icon: "android"        # UI 展示标签
  detailFields: [...]    # 详情页展示字段
```

规则：

- 核心流程(上传、列表、详情)不 `switch` 散落全代码
- 新类型 = 注册(扩展名 + MIME) + 可选 Parser + UI 展示适配
- **解析失败不影响文件可达**：解析器异常不阻断上传流程
- 每种类型有允许的扩展名/MIME 白名单
- 新增类型通过注册表扩展，不改核心表结构

## 替代方案

- **硬编码 switch/if-else**: 每加一种类型需改上传、详情、列表、搜索等多处代码
- **EAV 模型(Entity-Attribute-Value)**: 过度抽象，查询复杂，不适合本场景

## 后果

- **正面**: 新增类型改动最小化、局部化；核心流程稳定
- **负面**: 首次搭建 Registry 基础设施有额外成本(已完成)
- **约束**: 类型扩展前必须完善 Parser 的超时/沙箱机制(远期)
