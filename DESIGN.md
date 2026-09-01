# BabySteps Design System

> 状态：2026-09-01 项目规则。本文借鉴 `awesome-design-md` 的文档结构，只吸收 Airbnb 的亲和感、Apple 的清晰与留白、Notion 的柔和信息表面；不得复制它们的品牌资产、商标、版式或视觉识别。

## 1. Visual Theme & Atmosphere

BabySteps 是面向家庭成长记录的暖米色 Web3 产品。视觉关键词是：**可信、温暖、可读、克制、可复核**。

- 暖米色画布承载家庭感；海军蓝正文提供可靠对比；杏色、鼠尾草绿和柔紫只承担明确语义。
- 顶层页面与关键行动保留 BabySteps 的深色轮廓；嵌套信息使用柔和边框与浅阴影，避免每一层都像可点击主卡片。
- 数据、权限、交易与 Evidence 必须先清楚再漂亮。状态不能只靠颜色表达，必须同时有文字或图标。
- 不采用暗紫色 SaaS、霓虹赛博、玻璃拟态或大面积高饱和渐变。

## 2. Semantic Colors

颜色以 `web/src/styles.css` 的语义 token 为唯一实现来源。组件不得直接使用品牌参照色。

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 主文字 | `--color-text-primary` | `#173b4d` | 标题、正文重点、强边框 |
| 次文字 | `--color-text-secondary` | `#34576a` | 说明、辅助正文 |
| 弱文字 | `--color-text-muted` | `#526875` | 占位、低优先级元数据 |
| 画布 | `--color-surface-canvas` | `#fffaf0` | 页面背景 |
| 抬升表面 | `--color-surface-raised` | `#fffdf7` | 主卡片、表单、表格行 |
| 次级表面 | `--color-surface-subtle` | `#f7efe0` | 分组、空状态、非交互区域 |
| 暖色强调 | `--color-surface-accent` | `#f8dfc6` | 家庭提示、阶段性信息 |
| 主行动 | `--color-action-primary` | `#a94c22` | 主按钮、关键下一步 |
| 成功 | `--color-state-success-*` | 深绿 / 浅绿 | 已连接、已完成、已验证 |
| 警告 | `--color-state-warning-*` | 深棕 / 杏色 | 待处理、低置信度、部分覆盖 |
| 危险 | `--color-state-danger-*` | 深红 / 淡红 | 错误、拒绝、不可逆风险 |
| 信息 | `--color-state-info-*` | 深紫 / 淡紫 | Web3、架构、辅助信息 |

正文与状态文字在对应浅色表面上必须达到 WCAG AA 4.5:1。新增颜色先通过 `validate-design-system.mjs`，不得靠肉眼猜测。

## 3. Typography Rules

- 正文：`--font-family-body`，优先 Plus Jakarta Sans，中文回退 PingFang SC / Microsoft YaHei。
- 展示标题：`--font-family-display`，优先 Noto Serif SC；只用于 H1–H3 和关键阶段名。
- H1：`clamp(2rem, 5vw, 3.7rem)`，单页只出现一次；H2/H3 必须保持语义层级。
- 正文行高 1.6–1.8；长说明最大宽度约 72–86ch。
- 标题使用 `text-wrap: balance`，正文使用 `text-wrap: pretty`；路径、哈希和地址必须可换行。
- 数据列使用 `font-variant-numeric: tabular-nums`。指标名称、合约角色名和 Journey ID 不自动翻译。

## 4. Component Stylings & States

### Buttons and links

- 主行动：杏色实心；Web3 行动：信息紫；危险操作：淡红背景 + 深红文字；次行动：透明或浅表面。
- 所有主要触控目标至少 44×44px，项目默认按钮 48px 高。
- 必须提供 default、hover、active、focus-visible、disabled、loading、success、error 状态。
- loading 阶段禁用重复提交并保留清晰文字，例如“正在提交…”；不得只显示无标签旋转图标。
- 导航必须使用链接；业务动作必须使用按钮。

### Cards and surfaces

- 顶层主卡：深色 2px 轮廓 + `--shadow-elevated`，用于 Hero、页面主故事区和主导航。
- 次级功能卡：1px `--color-border-subtle` + `--shadow-soft`，用于任务、Provider、Keepsake、Evidence 子区。
- 内嵌数据区：浅表面 + 细边框，无额外阴影。
- 空状态必须说明“为什么为空、用户下一步是什么、当前是否异常”，不能只放插画。

### Forms

- input/select/textarea 继承统一字体、前景色与抬升表面；label 与控件建立可点击关联。
- focus-visible 使用 4px 柔紫轮廓；disabled 保持可读但明确降级。
- 校验错误靠近字段，并给出下一步；异步状态使用 `aria-live`。

### Status and evidence

- 状态徽标必须同时含文字，不得用绿/黄/红点单独表达。
- `已验证`、`历史快照`、`低置信度`、`不可用`、`未执行` 保持事实边界，不因视觉统一而改写。
- Evidence 深层卡片采用柔和层级，图表、媒体、哈希、角色表必须在卡内正常换行或局部滚动。

## 5. Layout & Spacing

- 页面容器最大宽 1200px，桌面两侧至少 16px；移动端至少 12px。
- 基础间距：4 / 8 / 12 / 16 / 24 / 32 / 48px；页面段落默认 `--space-section: 24px`。
- 同级卡片使用 CSS Grid/Flex；每个可收缩子项必须 `min-width: 0`。
- 不用 JavaScript 测量决定布局。大图和表格只允许组件内部水平滚动，根页面横向溢出必须为 0。
- 九条路由使用同一 `page-shell → product-nav → product-page/story-card → site-footer` 骨架。

## 6. Depth & Elevation

1. Canvas：无阴影，暖米色背景。
2. Inline surface：细边框、无阴影，用于表格行、定义列表和小型提示。
3. Nested card：`--shadow-soft`，用于次级功能和 Evidence 内容。
4. Page landmark：`--shadow-elevated`，只用于主导航、Hero、主故事卡。
5. Overlay：仅弹窗/抽屉使用；必须有焦点管理与关闭入口。

同一视觉区域最多出现两级可见阴影。禁止嵌套硬阴影造成“卡片套卡片套卡片”。

## 7. Do / Don't

### Do

- 先用语义 token 和现有 primitive，再写页面局部样式。
- 保留 BabySteps 的星形、暖米色、海军蓝和家庭叙事。
- 给真实数据、低样本、不可用和历史快照明确文字边界。
- 对 375 / 390 / 430 / 1440 四个宽度使用同一组件树。
- 动画只用 transform/opacity，并尊重 reduced motion。

### Don't

- 不复制 Airbnb、Apple、Notion 的品牌组件、图标、字体资产或页面布局。
- 不引入暗紫 SaaS、霓虹渐变、玻璃拟态或全页深色模式来“显得 Web3”。
- 不使用 `transition: all`、无替代的 `outline: none`、小于 44px 的核心触控目标。
- 不通过隐藏内容、缩小字号或截断关键 Evidence 来消除溢出。
- 不为视觉效果修改性能指标、AWS 状态、链上事实或 Evidence 结论。

## 8. Responsive Behavior

| 宽度 | 规则 |
| --- | --- |
| 1440 | 完整导航；Hero 可双列；次级卡片按内容优先级 2–3 列 |
| 430 | 单列为主；导航可水平滚动；按钮保持 44px；表格组件内部滚动 |
| 390 | 与 430 同组件树；长哈希、路径、角色名允许换行 |
| 375 | 最小验收宽度；页面边距 12px；无根级横向溢出 |

移动端不隐藏关键状态或操作，只调整顺序：标题与状态 → 主要数据 → 主行动 → 辅助说明。

## 9. Route Consistency

| 路由 | 第一优先级 | 表面策略 |
| --- | --- | --- |
| `/` | 钱包与成长状态 | 亲和 Hero + 清晰双账本 |
| `/tasks` | 任务状态与购买动作 | 任务卡为次级卡，价格/余额优先 |
| `/parent` | 家庭成长摘要 | 稳定分组，避免技术术语抢占 |
| `/keepsakes` | 抽取、融合、卡片收藏 | 稀有度可有色彩，操作状态仍用文字 |
| `/provider` | 创建、审核、完成流程 | 表单与生命周期分层，危险动作明确 |
| `/exchange` | 报价、授权、兑换 | 数值对齐，加载与重复提交受控 |
| `/profile` | 身份与会话 | 登录状态、权限和下一步清楚区分 |
| `/performance` | 指标、样本、来源 | Core Web Vitals 优先，诊断/空样本降级但可读 |
| `/evidence/` | 可复核证明与实现边界 | 深层信息用柔和卡片，媒体与哈希不挤压布局 |

## 10. Agent Prompt Guide

实现或修改 BabySteps UI 时，使用以下提示约束：

> 使用 BabySteps 暖米色家庭成长设计系统。保留海军蓝文字、杏色主行动、鼠尾草绿成功态与柔紫 Web3 信息态。顶层页面使用强轮廓，嵌套内容使用柔和边框和浅阴影。先保证事实、状态、键盘焦点、44px 触控与 375/390/430/1440 无根级横向溢出。不得复制外部品牌，不得修改 AWS、链上、性能指标或 Evidence 口径。完成后运行设计系统验证、功能测试、类型检查、生产构建和视觉回归。

快速验收命令：

```bash
node --test scripts/design-system-contract.test.mjs
node scripts/validate-design-system.mjs web/src/styles.css
pnpm visual:layout
pnpm visual:test
```

结构参考：[`VoltAgent/awesome-design-md`](https://github.com/VoltAgent/awesome-design-md)。外部参考只用于提炼文档维度和通用原则；BabySteps 的 token、组件状态、路线优先级和验收规则均由本项目定义。
