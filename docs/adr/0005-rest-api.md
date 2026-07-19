# ADR-0005: REST API 风格与统一错误结构

- **状态**: accepted
- **日期**: 2026-07-19
- **决策者**: 产品规范 (03-ARCHITECTURE.md §4.2)

## 背景

需要为前端、CI CLI、未来可能的移动端等多客户端提供一致的 API 接口。团队技术栈为 TypeScript (前端 React + 后端 Hono)。

## 决策

- API 风格: **REST** (首版)，不引入 GraphQL
- 统一错误结构: `{ code: string, message: string, details?: any }`
- 列表统一分页: cursor 或 page+pageSize (具体模型待 P1 结束前锁定)
- 文件上传: MVP 使用 multipart 直传 API；后续演进为预签名 → 直传对象存储 → 回调确认
- 后端框架: Hono 4 (已选定)

## 替代方案

- **GraphQL**: 对当前 MVP 的 CRUD 场景过度设计，增加学习成本和前端查询复杂度
- **tRPC**: 强绑定 TypeScript 全栈，不适合未来可能的非 TS 客户端(CLI/移动端)
- **gRPC**: 内网场景优势不明显，浏览器端调试和对接成本高

## 后果

- **正面**: REST 工具链成熟(OpenAPI 文档生成、Postman 调试、前端 fetch/axios 开箱即用)
- **负面**: 列表分页模型未统一(cursor vs offset)，需在 P1 结束前锁定
- **约束**: 所有 API 路由必须返回统一错误结构，前端错误处理可集中化
