# Artifact Center — 编码规范

> 适用：未来所有应用代码与 AI 生成代码。  
> 当前阶段：仅规范，不落地工程。

---

## 1. 总则

1. **可读性优先于聪明技巧**  
2. **一致性优先于个人偏好**  
3. **安全与权限不可事后补**  
4. **类型完整**：TypeScript `strict` 为默认方向  
5. **改动聚焦**：不顺手大重构无关文件  
6. **先符合 docs/**：违背 DESIGN/PRD 的代码即使能跑也不接受  

---

## 2. 语言与工程约定

### 2.1 TypeScript

- 启用严格模式（`strict`、避免隐式 `any`）
- 优先 `interface`/`type` 明确 DTO 与领域模型
- 禁止 `as any` 掩盖问题；必要时局部 `unknown` + 收窄
- 枚举：优先 string union 或 `as const` 对象
- 异步：`async/await`，避免裸未处理 Promise

### 2.2 命名

| 对象 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ArtifactCard` |
| 函数/变量 | camelCase | `formatFileSize` |
| 常量 | UPPER_SNAKE 或 const 对象 | `MAX_UPLOAD_SIZE` |
| 类型 | PascalCase | `ArtifactStatus` |
| 文件 | 与导出一致 | `ArtifactCard.tsx` |
| CSS 变量 | kebab | `--color-border` |
| API 路径 | kebab 或 REST 资源复数 | `/api/artifacts` |

### 2.3 领域用词（代码层）

与 PRD 一致：

- `Artifact` 不用 `Attachment` / `FileItem` 混称
- `Project` 不用 `AppSpace` 混称
- 状态：`active` | `deprecated` | `archived`（实现可扩展，但需文档）

---

## 3. 前端规范

### 3.1 组件

- 函数组件 + Hooks
- 一个文件一个主组件；子组件过重则拆分
- Props 类型导出；禁止隐式 props 黑洞
- 无业务的基础 UI 放 `shared/ui`
- 业务组件放 `features/*` 或 `entities/*`

### 3.2 副作用

- 数据获取集中在 feature 层 hooks
- 禁止在深层展示组件直接调用 API
- 上传、下载、权限判断逻辑可测试、可复用

### 3.3 样式

- Tailwind 为主，遵循设计 Token
- 禁止随意魔法数字颜色（`#e82939` 散落）；走语义 class 或 CSS 变量
- 响应式用统一断点
- 不引入第二套 UI 框架（禁止 Ant Design / MUI 并行）

### 3.4 动效

- 仅使用 Framer Motion 的克制动画
- 必须处理 `prefers-reduced-motion`
- 禁止为动效而动效

### 3.5 路由与懒加载

- 页面级懒加载可接受
- 权限路由守卫统一处理

---

## 4. 后端规范（未来）

- 接口输入输出校验（schema）
- 错误映射统一，不把堆栈直接给前端
- 所有突变操作鉴权
- 文件操作路径安全
- 日志：结构化，含 request id；敏感字段脱敏
- 迁移：数据库 schema 版本化

---

## 5. API 与 DTO

### 5.1 响应包络（建议）

```json
{
  "data": {},
  "error": null,
  "meta": { "requestId": "..." }
}
```

列表：

```json
{
  "data": [],
  "meta": { "nextCursor": "...", "total": 100 }
}
```

（具体以开工时 OpenAPI 为准，但需全站统一。）

### 5.2 时间

- 一律 ISO 8601 UTC 存储与传输
- 前端按时区展示

### 5.3 文件大小

- 存储与 API 用字节整数
- UI 再格式化

---

## 6. 错误处理

| 层级 | 做法 |
|------|------|
| UI | 用户可读文案 + 可恢复操作 |
| Feature | 映射 error code |
| API Client | 标准化网络/业务错误 |
| Server | 记录详细日志，返回安全消息 |

禁止 `catch (e) {}` 空吞。  
禁止 `alert(e.message)` 作为产品交互。

---

## 7. 测试

### MVP 最低期望

- 关键纯函数：版本解析、权限判断、文件大小格式化
- 关键 API handler 单测或集成测
- 核心路径 E2E 可延后，但要有计划

### 原则

- 测试行为与协议，不测实现细节刷存在感
- 不为一行 UI 强行 100% 覆盖导致脆弱快照泛滥

---

## 8. Git 与提交

### 8.1 提交信息

推荐 Conventional Commits：

```
feat: 支持制品按类型筛选
fix: 修复无权限下载返回 500
docs: 更新 DESIGN 阴影规则
chore: 调整 eslint 配置
```

中文英文均可，但团队内统一一种；**说明意图**。

### 8.2 分支

- `main` 稳定
- `feat/*` `fix/*` `docs/*`

### 8.3 代码评审关注点

1. 是否违背 docs  
2. 权限是否完整  
3. 类型与边界条件  
4. 有无秘密信息提交  
5. 有无引入违禁 UI 库/风格  

---

## 9. 注释与文档

- 注释解释 **为什么**，不复述代码
- 公开模块写简短职责说明
- 复杂上传协议必须有 sequence 说明（可放 docs）
- 不删业务逻辑时留下「临时」无主注释

---

## 10. 依赖管理

- 新增依赖需有理由：体积、维护、许可证
- 禁止引入与 Tailwind/shadcn 重复的重型组件库
- 锁定版本策略在工程初始化时确定（lockfile 必提交）

---

## 11. 安全编码清单

- [ ] 所有下载/上传/删除检查项目角色
- [ ] 无 SQL/命令拼接注入
- [ ] 上传扩展名与内容类型双策略（不过度迷信 MIME）
- [ ] Token 不进日志、不进前端仓库
- [ ] SSR/前端环境变量无密钥泄漏

---

## 12. AI 生成代码额外约束

1. 生成前读取相关 docs  
2. 不擅自扩大范围（如顺便做仪表盘）  
3. 不安装未要求的依赖  
4. 不删除现有规范文档  
5. 视觉实现必须对齐 `02-DESIGN.md` 与 `07-UI-PRINCIPLES.md`  
6. 若需求与文档冲突，**先停下来改文档或质疑需求**，不直接改产品气质  

---

## 13. 格式化与质量工具（开工时启用）

建议套件：

- ESLint + Prettier（或 Biome 二选一，全仓统一）
- TypeScript noEmit 检查
- Husky/lefthook 可选
- EditorConfig

规则以「少争吵、高一致」为准，避免 200 条矫枉过正 lint。

---

## 14. 文件与目录卫生

- 无 `utils2.ts` `temp.tsx` 长期存活
- 死代码及时删
- 生成物（build）不入库
- 大二进制样例不进 git（用 `references` 说明或 LFS 策略）

---

本规范与 `06-COMPONENT-GUIDELINES.md` 一起约束前端实现质量。
