# BabySteps 边缘 SSR、水合与 CSR 降级实施计划

> **Goal:** 在现有 Cloudflare Pages 发布链中交付真实浏览器路由、边缘 SSR、客户端水合和单次纯 CSR 降级，并把完整决策与验证固化到 Evidence。

**Architecture:** 使用一份共享路由契约，浏览器端由 `BrowserRouter` 驱动，边缘端由 `StaticRouter` 渲染。Vite 分别构建 client 与 webworker SSR bundle，构建脚本把 SSR worker 固化为 Pages advanced-mode 的 `_worker.js`。公开页面输出完整匿名 HTML，钱包/账户页面只输出确定性外壳；SSR 超时或异常时显式返回静态 CSR 入口。

**Tech Stack:** React 19、React Router、Vite 8、Cloudflare Pages advanced mode、Vitest、Testing Library、现有性能 SDK。

---

## Task 1：共享路由契约与真实浏览器 URL

**Files**
- Add: `web/src/routing/routes.tsx`
- Add: `web/src/routing/routes.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/src/components/ProductNavigation.tsx`
- Modify: `web/src/components/CourseEvidenceFooter.tsx`
- Modify: `web/package.json`
- Modify: `pnpm-lock.yaml`

1. 先写失败测试，覆盖 `/keepsakes` 深链、真实链接、`aria-current`、未知路径 404 页面和前进/后退。
2. 安装已核实稳定版本的 `react-router-dom`。
3. 建立单一 `RouteDefinition` 数据源，包含 path、view、label、SSR policy 与懒加载页面。
4. 将内存状态切页替换成 `Routes`/`Route`；首页直接加载，其余页面静态懒加载。
5. 运行路由专项测试并确认绿色。

## Task 2：可在服务端安全运行的应用外壳

**Files**
- Add: `web/src/app/AppShell.tsx`
- Add: `web/src/app/RouteLoading.tsx`
- Add: `web/src/app/RouteErrorBoundary.tsx`
- Add: `web/src/app/serverShell.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/config/providers.tsx`

1. 先写服务端渲染失败测试，证明当前浏览器 Provider 不能进入 SSR 路径。
2. 抽离不依赖 Privy/Wagmi 的 `AppShell` 与确定性账户页外壳。
3. 浏览器端在路由进入交互区域后挂载现有 Provider；SSR 不加载用户态 Provider。
4. 增加顶层路由加载状态与 Error Boundary。
5. 验证服务端公开页面不包含钱包地址、余额、Cookie、Token 或浏览器 API 访问。

## Task 3：安全 HTML 模板与 React Web Streams

**Files**
- Add: `web/src/ssr/renderState.ts`
- Add: `web/src/ssr/renderState.test.ts`
- Add: `web/src/ssr/html.ts`
- Add: `web/src/ssr/html.test.ts`
- Add: `web/src/entry-server.tsx`

1. 先写失败测试，覆盖 `<script>`、`&`、U+2028/U+2029 安全序列化和无 PII 状态契约。
2. 定义 `RenderState`（mode、pathname、version），生成不可执行的 JSON script 与 `data-render-mode` 标记。
3. 使用 `renderToReadableStream` + `StaticRouter` 输出完整文档；等待 shell ready，支持 AbortSignal。
4. 对公开路由渲染真实匿名内容，对用户态路由渲染与客户端首帧一致的确定性外壳。
5. 验证未知路由内容与 404 状态模型一致。

## Task 4：Cloudflare Pages advanced-mode Worker 与显式降级

**Files**
- Add: `web/src/pages-worker.ts`
- Add: `web/src/pages-worker.test.ts`
- Add: `web/src/ssr/requestPolicy.ts`
- Add: `web/src/ssr/requestPolicy.test.ts`

1. 先写失败测试：静态资产透传、HTML GET/HEAD、未知页面 404、非 HTML/非页面请求不误重写、SSR 异常和超时返回 CSR。
2. 只允许路由白名单进入 SSR；静态文件始终调用 `env.ASSETS.fetch`。
3. 对 SSR 设置硬超时和 AbortController，成功返回 `x-babysteps-render-mode: ssr`。
4. 异常/超时显式读取 `/index.html`，返回 `x-babysteps-render-mode: csr-fallback`、`no-store` 和安全响应头。
5. 结构化日志只记录路径、模式、耗时和错误类别，不记录请求头/正文/用户数据。

## Task 5：客户端水合与单次 CSR 恢复

**Files**
- Add: `web/src/bootstrap.tsx`
- Add: `web/src/bootstrap.test.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/performance/client.ts`
- Modify: `web/src/performance/client.test.ts`

1. 先写失败测试：SSR 标记调用 `hydrateRoot`；无标记调用 `createRoot`；致命水合错误最多一次 CSR；recoverable error 只上报。
2. 把应用工厂、Provider 和 StrictMode 封装为可注入启动函数，便于测试。
3. 解析可信的内联 RenderState；不读取用户数据。
4. 水合成功后启用 Provider 和交互；致命启动错误清空根节点并单次 `createRoot`。
5. 性能 SDK route 改为 pathname，并记录 `ssr.shell`、`hydration.duration`、`hydration.recoverable_error` 和 `csr.fallback`。

## Task 6：双端构建与产物 Gate

**Files**
- Modify: `web/vite.config.ts`
- Add: `web/vite.ssr.config.ts`
- Add: `web/scripts/build-pages.mjs`
- Modify: `web/package.json`
- Modify: `scripts/build-routing.test.mjs`
- Modify: `scripts/build.mjs`
- Modify: `scripts/validate-pages-workflow.mjs`
- Modify: `scripts/validate-pages-workflow.test.mjs`

1. 先扩展 Gate 测试，要求根路径 client 资产、非空 `index.html`、webworker SSR bundle 和最终 `_worker.js`。
2. 将默认 Vite base 从 `./` 改为 `/`，移除已停用 GitHub Pages 的旧解释。
3. client build 输出 `dist/client` 临时目录；SSR build 使用 `ssr.target="webworker"` 与 bundled dependencies。
4. 构建脚本将 client 产物复制到最终 `dist`，把 SSR bundle固定为 `dist/_worker.js`，并检查文件数、字节数和 `index.html`。
5. 保持 `.github/baby2b-publish.yml` 的发布目录 `web/dist` 不变，避免第二套发布链。

## Task 7：Evidence、架构图、时序图与本地 Gate

**Files**
- Modify: `web/src/pages/EvidencePage.tsx`
- Modify: `web/src/pages/EvidencePage.test.tsx`
- Modify: `docs/architecture/starbuddy-web3-architecture.mmd`
- Modify: `docs/architecture/starbuddy-web3-global-architecture.svg`
- Modify: `docs/architecture/starbuddy-web3-business-sequence.svg`
- Add: `docs/evidence/testing/2026-08-14-rendering-resilience.md`
- Modify: `scripts/validate-delivery-evidence.mjs`
- Modify: `scripts/validate-delivery-evidence.test.mjs`

1. 先写失败 Gate，要求 Evidence 出现原问题、三方案比较、最终决策、代码映射、响应头、失败注入、AWS 零增量成本和真实截图引用。
2. 更新全局架构图：Cloudflare CDN/Worker、SSR、静态资产、浏览器水合、Privy/Wagmi 边界、CSR 降级、性能事件、Actions 发布与回滚。
3. 更新关键时序：正常 SSR→水合，以及 SSR 超时/水合致命错误→单次 CSR 两条分支。
4. Evidence 页面用大白话解释“看哪里、证明什么”，并明确用户态数据仍是 CSR。
5. 记录作业要求→实现功能→代码位置→验证证据→状态，不记录聊天和工具制作噪音。

## Task 8：完整验证、预览与生产确认点

**Files**
- Add/replace: `docs/evidence/screenshots/2026-08-14-rendering-resilience/*`
- Modify: `docs/evidence/testing/2026-08-14-rendering-resilience.md`

1. 运行 web 单测、全仓相关 validator、类型检查、Biome 和双端生产构建。
2. 本地以 Pages worker 兼容方式启动产物，验证 `/`、`/keepsakes`、`/performance`、`/evidence`、未知路径、SSR 故障注入和响应头。
3. 在 375、390、430、1440 宽度检查无根级横向溢出、图像可读、SSR 与水合后主标题一致，并保存脱敏截图。
4. 运行公开内容、链接、Evidence 与项目命名扫描。
5. 提交并推送功能分支，创建 Cloudflare/GitHub 预览；保存 Run、commit、HTTP、桌面/手机截图。
6. 仅在用户看过预览并明确授权后合并 main、触发生产；生产验收与回滚证据属于后续确认点。
