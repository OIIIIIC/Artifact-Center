# Artifact Center — 组件指南

> 目标：让 UI 实现可复用、可组合、气质统一。  
> 基础库：shadcn/ui + Tailwind；图标：Lucide；动效：Framer Motion。

---

## 1. 组件分层

```
shared/ui          → 无业务：Button, Input, Dialog, Badge…
entities/*/ui      → 轻业务展示：ArtifactTypeBadge, UserAvatar…
features/*/ui      → 含交互流程：UploadDropzone, ArtifactFilters…
widgets            → 跨 feature 的页面区块：AppSidebar, GlobalSearch
pages              → 组装，不造新视觉语言
```

**依赖方向：** pages → widgets/features → entities → shared  
禁止 shared 依赖 features。

---

## 2. shadcn/ui 使用原则

1. shadcn 是 **起点**，不是最终视觉  
2. 引入后必须按 DESIGN Token 改造颜色、圆角、阴影、字号  
3. 禁止保留明显「模板后台」默认密度  
4. 不整库无脑安装用不到的组件  
5. 修改集中在 `shared/ui`，业务不要 fork 一份按钮样式  

### 需要重点定制的组件

| 组件 | 定制点 |
|------|--------|
| Button | 主按钮气质、高度、focus |
| Input/Textarea | 高度、边框、error |
| Card | 边框优先、padding |
| Dialog | 圆角、标题层级、footer 按钮序 |
| Dropdown | 轻阴影、项高 |
| Badge | 中性优先、状态浅底 |
| Table | 仅紧凑数据场景；默认别用满屏 |
| Tabs | 轻指示，不粗彩条 |
| Tooltip | 延迟与对比度 |
| Command | 搜索面板的灵魂组件，必须精致 |

---

## 3. 基础组件规范

### 3.1 Button

**变体：** `default` | `secondary` | `ghost` | `outline` | `destructive` | `link`

**尺寸：** `sm` | `md` | `lg`（全局不超过三档）

**规则：**

- 图标按钮必须有 `aria-label`
- 图标+文字间距固定
- Loading 时保留最小宽度
- 禁止同一区域多个 `default` 抢主操作

### 3.2 Input / Select / Textarea

- Label 始终可见（占位符不等于标签）
- 错误文案在控件下方
- 可选 Hint 用 tertiary 色
- Select 长列表可搜索（类型、项目选择）

### 3.3 Card

**结构槽位：**

```
Card
  CardHeader：title / description / action
  CardContent：主内容
  CardFooter：次要信息或操作（少用）
```

**可点击卡片：**

- 使用 `Link` 或明确 button 行为
- 内部再放按钮时，注意事件冒泡与无障碍

### 3.4 Badge

| 用途 | 样式 |
|------|------|
| 类型 APK/AAB/EXE/ZIP | 中性或极低饱和色，固定映射 |
| env dev/staging/prod | 语义浅色，prod 最克制 |
| status active/deprecated/archived | success/warning/muted |

映射表应集中定义，禁止各页面私自配色。

### 3.5 Dialog / AlertDialog

- 标题明确动作对象：「归档制品？」
- 破坏性按钮右置或按平台惯例，但全站统一
- 确认文案包含对象名称
- 不要用 Dialog 做复杂多步上传（用全页或 Stepper）

### 3.6 Dropdown Menu

- 危险项红色并可能分隔
- 快捷键提示可在右侧（P1）
- 菜单项不超过约 8 个，多则分组或改页面

### 3.7 Toast

- 成功短、失败可操作
- 同时多个 toast 不堆满屏
- 不代替表单校验错误

### 3.8 Skeleton

- 与真实布局同结构
- 列表骨架 3–8 行足够
- 避免闪烁：设定合理 `isLoading` 策略

---

## 4. 业务组件清单（规划）

### 4.1 布局

| 组件 | 职责 |
|------|------|
| `AppShell` | 顶栏/侧栏/内容槽 |
| `PageHeader` | 标题、描述、主操作 |
| `PageToolbar` | 筛选与视图切换 |
| `EmptyState` | 统一空状态 |
| `ErrorState` | 统一错误恢复 |

### 4.2 项目

| 组件 | 职责 |
|------|------|
| `ProjectCard` | 项目入口卡 |
| `ProjectGrid` | 网格 |
| `ProjectSwitcher` | 上下文切换（可选） |

### 4.3 制品

| 组件 | 职责 |
|------|------|
| `ArtifactCard` | 卡片视图 |
| `ArtifactRow` | 列表行 |
| `ArtifactList` | 数据+虚拟列表预留 |
| `ArtifactTypeBadge` | 类型 |
| `ArtifactStatusBadge` | 状态 |
| `ArtifactFilters` | 筛选条 |
| `ArtifactMetaList` | 详情定义列表 |
| `ChecksumCopy` | 哈希复制 |
| `DownloadButton` | 权限感知下载 |
| `CopyLinkButton` | 复制链接 |

### 4.4 上传

| 组件 | 职责 |
|------|------|
| `UploadDropzone` | 拖拽区 |
| `UploadQueue` | 队列与进度 |
| `UploadMetaForm` | 元数据 |
| `UploadSuccessPanel` | 完成 CTA |

### 4.5 搜索

| 组件 | 职责 |
|------|------|
| `GlobalSearch` / `CommandPalette` | 全局搜索 |
| `SearchResultGroup` | 分组结果 |

---

## 5. 组合模式

### 5.1 PageHeader 模式

```
左：标题 + 可选描述 + 可选面包屑（轻）
右：Secondary… + Primary
```

移动端：主操作可沉底或进菜单，但不可消失。

### 5.2 Toolbar 模式

```
左：筛选芯片/下拉（默认收纳「更多筛选」）
右：排序、视图切换、刷新
```

筛选过多时不要把工具条撑成第二导航。

### 5.3 详情双栏

```
主栏 2/3：概述、备注、预览信息
侧栏 1/3：元数据、哈希、审计摘要
```

窄屏侧栏下置。

### 5.4 行内操作

- 默认隐藏或轻显，hover/focus 显示
- 触摸设备：常显更多按钮
- 主操作（下载）可常显

---

## 6. 状态驱动 UI

组件必须显式处理：

| 状态 | 表现 |
|------|------|
| empty | EmptyState |
| loading | Skeleton |
| error | ErrorState + retry |
| partial | 列表可用 + 局部错误 |
| forbidden | 无权限说明，非空白 |
| success flash | toast 或行内确认 |

禁止只画 happy path。

---

## 7. Props 设计原则

1. **受控优先** 于复杂表单  
2. 布尔 prop 避免互斥爆炸，用 `variant` / `status`  
3. 事件命名 `onUpload` `onFilterChange`  
4. 不透传无文档的巨大 `options` any  
5. 样式扩展：`className` 合并用标准工具（`cn`）  

---

## 8. 可访问性

- 交互组件可键盘到达
- Dialog 打开聚焦、关闭回焦
- 颜色不是唯一状态信道
- 列表与卡片在读屏上有合理名称（文件名 + 版本）
- 上传区支持键盘选择文件

---

## 9. 性能

- 长列表预留虚拟化接口（数据量大时）
- 图片/图标避免超大 SVG 重复内联失控
- 搜索输入防抖
- 避免在列表行创建重型订阅

---

## 10. 动效封装

推荐少量包装：

- `FadeIn`：内容进入
- `Presence`：折叠筛选

业务组件不要各自发明弹簧参数。统一 duration token。

---

## 11. 禁止的组件反模式

| 反模式 | 原因 |
|--------|------|
| 巨型 `index.tsx` 三千行页面 | 不可维护 |
| 复制粘贴三份 Button 样式 | 漂移 |
| Table 默认包一切 | 违反产品气质 |
| 彩色左边条卡片列表 | 廉价后台感 |
| 每个 feature 私有 Dialog 视觉 | 不一致 |
| 在 shared 写死业务文案拼装过度 | 难复用 |

---

## 12. 新建组件检查清单

- [ ] 落在正确分层？  
- [ ] 是否已有 shadcn/现成组件可扩展？  
- [ ] 是否符合 DESIGN 的间距/字体/颜色？  
- [ ] 是否处理 loading/empty/error？  
- [ ] 是否可键盘使用？  
- [ ] 是否引入违禁依赖？  
- [ ] 故事/示例或最小用法是否清晰（可选 Storybook，不强制）  

---

## 13. 与设计文档的关系

- 视觉争议 → `02-DESIGN.md`  
- 交互哲学 → `07-UI-PRINCIPLES.md`  
- 本文件 → **怎么拆组件、怎么组合**  

三者冲突时以 DESIGN 与愿景为准，并回头修订本指南。
