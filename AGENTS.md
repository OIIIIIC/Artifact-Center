## 1. Official Best Practices First

如果项目规范与技术栈官方最佳实践发生冲突：

1. 先明确说明冲突原因。
2. 优先采用官方最佳实践。
3. 在官方最佳实践基础上完成项目定制。
4. 不得绕过官方 CLI 初始化。
5. 不得随意修改官方推荐项目结构，除非有充分理由。

---

## 2. Read Documentation First

开始任何开发之前，必须阅读 docs 目录中的相关文档。

包括但不限于：

- PRD
- DESIGN
- DESIGN SYSTEM
- ARCHITECTURE

禁止忽略已有规范直接开发。

---

## 3. Design System Is the Source of Truth

所有 UI 必须遵循 Design System。

禁止：

- 新增颜色体系
- 新增按钮风格
- 新增间距规则
- 新增字体规范

所有新增设计必须保持一致。

---

## 4. Consistency Over Creativity

优先保证整个产品的一致性。

不要为了局部页面而破坏整体体验。

---

## 5. Keep It Simple

避免：

- 过度设计
- 过早抽象
- 无意义封装
- 无实际价值的新功能

优先简单、清晰、可维护。

---

## 6. Prefer Composition

优先组合已有能力。

不要复制已有代码。

不要重复实现已有组件。

---

## 7. Minimize Dependencies

新增第三方依赖之前：

必须说明：

- 为什么需要
- 为什么现有能力不能解决
- 是否存在维护风险

避免引入重量级依赖。

---

## 8. Accessibility Matters

所有交互必须考虑：

- Keyboard Navigation
- Focus State
- Hover State
- Screen Reader
- Color Contrast

---

## 9. Dark Mode Is First-class

所有页面必须同时支持：

- Light
- Dark

禁止只完成 Light Mode。

---

## 10. Performance by Default

默认关注性能。

避免：

- 不必要渲染
- 大对象传递
- 重复计算
- 无意义动画

---

## 11. Never Start Coding Blindly

如果需求存在歧义：

先提出问题。

不要猜测需求。

不要自行发明产品逻辑。

---

## 12. Think Before Implementing

任何复杂功能：

先分析。

再设计。

最后实现。

不要直接开始写代码。
