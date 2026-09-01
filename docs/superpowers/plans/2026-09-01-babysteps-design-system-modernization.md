# BabySteps 设计系统现代化实施计划

> 基线：`origin/main` `230b24df3909d3ee2c7081897052f1610bd65f20`

## 1. 契约与 RED

- 新增 `scripts/design-system-contract.test.mjs`。
- 先运行测试，确认因验证器缺失而失败。
- 增加受控突变：40px 触控目标、1:1 状态对比度必须被拒绝。

## 2. 最小 GREEN

- 新增 `scripts/validate-design-system.mjs`。
- 校验语义 token、未定义变量、WCAG AA、select focus、触控、数字排版、reduced motion 和禁用 `transition: all`。
- 在 `web/src/styles.css` 建立语义 token，并用别名兼容旧组件。

## 3. 视觉层级

- 顶层 Hero / story / navigation 保留 BabySteps 强轮廓。
- 任务、Provider、Identity、Keepsake、Evidence 嵌套卡片切换为细边框 + `--shadow-soft`。
- 统一标题换行、表格数字、placeholder、disabled、active 和 focus-visible。

## 4. 项目规则

- 新增根目录 `DESIGN.md`，记录设计身份、语义、组件、响应式、路线和 Agent Prompt Guide。
- 不测试人类文档文本；测试只覆盖验证器的可观察行为。

## 5. 有界依赖切片

- 保留现有 TanStack Query；不新增 React Hook Form、Zod resolver、Motion 或图表库。
- 先为 Owner 完成审核列表补手动加载、重复点击、错误重试、会话切换、刷新失败测试。
- 把 D1 `list()` 读取交给 `useQuery(enabled: false)`；链上确认、Wagmi、交易回执与失效逻辑保持原所有权。
- 缓存 key 每次挂载隔离；卸载时取消并删除；错误或刷新期间不渲染可操作的旧记录。

## 6. 确定性 Gate 加固

- Backstop `onReady` 固定 locale、timezone、浅色和 reduced-motion；等待失败、pageerror、布局不稳定或根级溢出均失败。
- Evidence 的原生视频控件只在截图钩子中替换为同一产品 poster，规避超长页面分块截图的浏览器合成层漂移；该替换必须有专门测试，生产页面保持原生视频控件。
- 从精确 `origin/main` 构建九路由基线，同时记录全部 JavaScript raw/gzip 总量。
- 候选的任一路由 chunk 或全部 JavaScript gzip 总量增长超过 30 KiB 即失败；缺产物、基线或路由也失败。
- 不自动批准 Backstop reference；候选图必须逐页人工审阅。

## 7. 本地 Gate

依次执行：

```bash
node --test scripts/design-system-contract.test.mjs
node scripts/validate-design-system.mjs web/src/styles.css
pnpm test:validators
pnpm --filter @babysteps/web test
pnpm --filter @babysteps/web typecheck
pnpm build
pnpm validate:rendering-runtime
pnpm visual:layout
pnpm visual:test
```

视觉候选覆盖 375 / 390 / 430 / 1440；任何差异都人工审阅，不自动更新 reference。

## 8. 发布前 Gate

- 运行公共内容与密钥扫描。
- 保存 Chrome cold load + 代表性交互的可比 trace、截图和前后指标表。
- 独立审查后才提交、PR、Preview 与生产发布。
- 本任务不启动 AWS Performance Runtime，不改变免费计划或云资源。
