# BabySteps 设计系统现代化规格

## 目标

在不改变业务逻辑、真实数据、性能指标口径、AWS Runtime、链上行为和 Evidence 事实的前提下，把九条产品路由统一到一套可执行、可验证的 BabySteps 设计系统。

## 当前问题

1. 颜色主要以视觉名称暴露，缺少“文字 / 表面 / 边框 / 状态”的语义层。
2. 多层卡片重复使用深色边框和硬阴影，Evidence 深层结构与主页面争夺视觉优先级。
3. `--cream`、`--teal` 有引用无定义；原生 `select` 未进入全局字体与 focus-visible 契约。
4. 样式有 reduced-motion 和响应式基础，但缺少独立的设计系统确定性 Gate。
5. Provider 的 Owner 完成审核列表仍以组件本地状态手写 HTTP 请求状态；现有 TanStack Query 只用于失效通知，没有真正接管一个 HTTP 读取切片。
6. 现有视觉 Gate 会吞掉部分等待失败，构建流程也没有对九路由 chunk 与全部 JavaScript gzip 增量做 fail-closed 校验。

## 设计方向

- 身份：BabySteps 自有的暖米色、星形、海军蓝与家庭成长叙事。
- 外部参考：只借鉴 Airbnb 的亲和感、Apple 的清晰留白、Notion 的柔和信息表面；不复制品牌资产。
- 深度：页面地标使用强轮廓；功能卡使用柔和阴影；内嵌数据区不叠加阴影。
- 状态：default / hover / active / focus-visible / disabled / loading / success / error 均可识别，不能仅靠颜色。
- 数据：表格与指标使用等宽数字；空样本、低置信度、不可用和未执行保持原事实口径。

## 技术边界

- 修改设计文档、全局 CSS、设计系统/视觉/bundle Gate，以及一个 Provider HTTP 读取切片和对应测试。
- 不新增运行时依赖；复用已安装的 TanStack Query，只接管 `OwnerCompletionReviewPanel` 的 D1 列表读取。Query 缓存按组件会话隔离并在卸载时取消、删除，不能跨登录主体复用。
- React Hook Form：拒绝。当前 2–4 字段表单与链上交易 Hook 已有明确状态所有权，引入后增加的抽象多于删除的样板。
- Zod / resolver：本轮延后。Web 尚无直接 Zod 边界；若未来采用，应优先校验 HTTP 响应，而不是为简单表单引入。
- Motion / Framer Motion：拒绝。现有 CSS 动效已覆盖有意义反馈并尊重 reduced-motion；没有需要运行时动效库解决的缺口。
- 图表库：拒绝。性能页本轮不改数据或图表口径，加入图表依赖只会增加 bundle。
- 不修改 React 页面结构、API、性能 SDK、Cloudflare Worker、AWS、合约或 Evidence 数据。
- 实现阶段不自动更新 Backstop reference；候选差异必须人工逐页审阅，只有最终验收确认后才能更新并复跑零差异 Gate。

## 验收标准

1. `DESIGN.md` 覆盖主题、语义色、字体、组件状态、布局、深度、Do/Don't、响应式与 Agent Prompt Guide。
2. 语义 token 完整，所有 CSS 自定义属性有定义；状态文字与对应表面达到 WCAG AA。
3. input/select/textarea 统一字体、颜色与键盘焦点；核心按钮至少 44px；reduced-motion 继续生效。
4. 九条路由维持同一组件树，375/390/430/1440 无根级横向溢出，pageerror 为 0。
5. Evidence 的角色、要求映射、媒体和架构图在窄屏可读，嵌套内容不再使用与页面主卡同级的硬阴影。
6. 设计系统单测、现有 validator、Web 测试、类型检查、生产构建、SSR/404 与 Backstop Gate 全部通过。
7. Chrome cold load 与代表性交互候选不造成 LCP/INP/CLS 回退；结果与来源按全局性能规则留证。
8. Provider D1 列表默认不请求、点击后加载、加载中防重复点击；错误或刷新失败时不展示可操作的旧 Owner 数据；卸载后不保留上一会话缓存。
9. 构建必须生成九路由 chunk gzip 对比和全部 JavaScript gzip 总量对比；任一路由或总量相对精确基线增长超过 30 KiB 时失败，缺少 dist、基线或路由也失败。

## 风险与回滚

- 风险：大范围 CSS token 替换可能影响历史视觉基线。控制方式：别名兼容旧 token，先只替换共享层和嵌套深度。
- 风险：字体或阴影变化造成截图差异。控制方式：固定 Backstop 环境，人工审阅而非自动接受。
- 风险：Evidence 超长页面中的 Chromium 原生视频控件使用独立合成层，分块全页截图会漂移。控制方式：仅在 Backstop `onReady` 中用产品自有 poster 替换原生视频层；不修改生产 DOM，不屏蔽产品文字、错误态或布局，并以回归测试锁定该最小替换。
- 风险：Owner D1 缓存跨身份泄露。控制方式：每次挂载使用隔离 key，卸载时 cancel + remove，刷新错误时隐藏旧记录，并用会话切换测试锁定。
- 风险：只统计命名路由 chunk 会漏掉 vendor 依赖。控制方式：路由 chunk 与全部 JavaScript gzip 总量同时比较。
- 回滚：样式可移除新增语义映射并继续使用旧别名；Provider 读取可恢复原本地状态实现；bundle/视觉 Gate 可独立回退，不影响 AWS、链上或数据口径。
