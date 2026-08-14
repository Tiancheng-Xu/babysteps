# BabySteps 浏览器路由、边缘 SSR、水合与 CSR 降级设计

## 目标

把当前依赖 React 内存状态的“页面切换”改为真实、可分享的浏览器 URL，并在同一套 Cloudflare Pages 产物中实现三级渲染：

1. Cloudflare 边缘 SSR 先返回可阅读的 HTML；
2. 浏览器对完全一致的 HTML 执行水合并接管交互；
3. SSR 或水合发生致命错误时，只降级一次到纯 CSR。

这项优化直接吸收 `04-Serverless` 中“服务端完整 HTML 才能水合、骨架失败要走纯 CSR、流式渲染必须有超时和失败边界”和 `05-aws` 中“边缘平台负责前端渲染、AWS 保留后端与数据职责、不要重复建设”的课程结论。实现后的设计、代码位置、测试、预览响应头、桌面/手机截图和限制必须进入项目 Evidence，不能把计划写成完成。

## 已确认现状

- `App.tsx` 通过 `useState` 切换九个页面，没有浏览器路由；刷新、收藏和分享无法保留当前页面。
- `main.tsx` 只调用 `createRoot`；`index.html` 没有服务端 React HTML，所以当前没有水合。
- Cloudflare Pages 是唯一前端发布平台，AWS 性能链路只承担观测，不承担页面 SSR。
- Privy、Wagmi、钱包、余额和交易依赖浏览器与当前用户，不能在服务端读取或缓存。

## 路由契约

| 路径 | 产品区域 | 服务端输出 |
| --- | --- | --- |
| `/` | 首页 | 完整匿名内容 |
| `/tasks` | 成长任务市场 | 可读匿名摘要壳 |
| `/keepsakes` | 星宝纪念馆 | 可读公共摘要壳 |
| `/evidence` | 项目 Evidence | 可读证据摘要壳；完整交互内容由客户端激活 |
| `/parent` | 家长中心 | 不含账户数据的稳定外壳 |
| `/provider` | Provider 控制台 | 不含权限数据的稳定外壳 |
| `/exchange` | BABY 兑换 | 不含余额和报价的稳定外壳 |
| `/profile` | 个人中心 | 不含身份数据的稳定外壳 |
| `/performance` | 性能观测 | 不含实时查询结果的稳定外壳 |

未知路径返回真实 HTTP 404 和友好的 React 页面，不能静默回首页。导航使用真实链接并通过 `aria-current="page"` 标记当前位置。浏览器前进、后退、刷新、收藏和分享必须保持页面。

## 三层渲染架构

### 1. Cloudflare 边缘 SSR

生产构建生成两类产物：浏览器资产和适用于 Web Worker 的 SSR bundle。Pages advanced mode 的 `_worker.js` 接管请求：

- 静态资产、metadata、favicon 和 manifest 交给 `env.ASSETS.fetch`；缺失资产保持真实 404。
- 只有明确允许的 HTML `GET`/`HEAD` 路由进入 SSR；不把 API、错误响应或任意路径重写成 200 HTML。
- 使用 React Web Streams 生成 HTML，并把“创建流 + 读完整条流”共同纳入硬超时和中止信号；完成后才返回响应，确保还能安全降级。
- SSR 成功返回 `x-babysteps-render-mode: ssr`；未知页面返回相同渲染模式但状态码 404。
- SSR 抛错、超时或流创建失败时，显式读取静态 `index.html`，返回 `x-babysteps-render-mode: csr-fallback`、`Cache-Control: no-store` 和原请求路径可恢复的 CSR 外壳。

Cloudflare advanced mode 不提供可依赖的 `passThroughOnException()`，因此降级必须是可测试的显式 `try/catch`，不能依赖平台猜测。

### 2. 浏览器水合

服务端与浏览器共用同一套路由定义和确定性页面外壳。HTML 通过安全 JSON script 标记渲染模式、请求路径和公开构建版本；序列化必须转义 `<`、`>`、`&`、U+2028 和 U+2029，不注入 Token、Cookie、钱包地址、余额或用户资料。

客户端启动规则：

- 根节点标记为 SSR、已有服务端内容、请求路径与构建版本均一致时调用 `hydrateRoot`。
- 使用 `onRecoverableError` 记录可恢复的不匹配，但不因此重复挂载。
- 水合启动发生致命错误时，清空根节点并仅调用一次 `createRoot`，转为纯 CSR。
- 根节点没有 SSR 标记时直接 `createRoot`，用于静态回退、本地 CSR 和平台故障恢复。
- CSR 本身的渲染错误交给顶层 Error Boundary，显示可操作的恢复提示；不宣称 CSR 能挽救所有代码错误。

### 3. 浏览器交互边界

服务端应用不加载 Privy、Wagmi 或浏览器钱包 Provider。客户端水合后才挂载这些 Provider，并激活账户、余额、签名、链上读取和交易交互。用户态页面的服务端外壳在首个浏览器渲染时保持结构一致，避免把“加载中”错误地水合成真实账户数据。

## 路由分包与性能

- 首页保持直接入口；其他页面使用静态 `React.lazy` 路由分包。
- 性能 SDK 直接记录 `window.location.pathname`，不再读取人工写入的页面状态。
- 新增 `ssr.shell`、`hydration.duration`、`hydration.recoverable_error`、`csr.fallback` 等不含用户数据的自定义指标；SDK 失败仍不得影响宿主应用。
- 响应头与结构化边缘日志记录渲染模式、路由、耗时和匿名错误分类，不记录 Cookie、Authorization、请求正文或 PII。

## 缓存、安全与失败边界

- 首阶段不缓存个性化 HTML。账户、钱包、带认证头或查询参数的请求统一 `private, no-store`。
- 公开匿名 HTML 可在后续证明内容一致性后加入短 TTL Cache API；本次不把模块内 LRU 当跨实例缓存，也不把未验证缓存写进完成证据。
- SSR 只接受本项目路由，不根据用户输入请求任意上游，避免 SSRF。
- 设置 CSP、`X-Content-Type-Options`、`Referrer-Policy` 和明确的 HTML content type。
- 超时、渲染异常和资产读取失败各自保留准确状态；静态资源错误不能被 CSR 回退掩盖。

## 部署与 AWS 边界

继续使用现有 Cloudflare Pages 项目 `babysteps`，同一 GitHub Actions 构建同时产出浏览器资产和 `_worker.js`。不新增 Lambda、Lambda@Edge、CloudFront、API Gateway、NAT、RDS、ECS 或 OIDC。

现有 AWS 共享 VPC、NAT、RDS、OIDC 和 Foundation 均为受保护资源，本次只在 Evidence 复用矩阵中说明“未修改”。性能采集若启用，仍通过现有 Worker API 与已验证的 AWS 性能流水线契约；渲染优化的增量 AWS 费用为 0 美元。

## Evidence 记录契约

Evidence 不复制聊天原文，而是整理为可复核的工程记录：

1. 原问题：内存切页、纯 CSR 首屏和不可分享深链；
2. 方案比较：纯 CSR、AWS SSR、Cloudflare 边缘 SSR；
3. 决策：Cloudflare SSR → 水合 → 单次纯 CSR 降级；
4. 代码映射：路由、服务端入口、客户端启动、序列化、超时、指标和 Gate；
5. 验证：单测、类型检查、双端生产构建、响应头、404、故障注入、375/390/430/1440 响应式与预览截图；
6. 限制：钱包和个性化状态不做 SSR，公开 HTML 缓存未验证前不启用，生产发布需单独确认。

架构图和关键时序图必须更新，明确展示 Cloudflare CDN/Worker、SSR 流、静态资产、浏览器水合、Privy/Wagmi 客户端边界、CSR 降级、性能事件和 GitHub Actions 发布/回滚。

## 验证与完成标准

- 路由测试：深链、导航、当前链接、前进/后退、未知路径。
- 客户端启动测试：SSR 水合、无标记 CSR、水合致命错误仅降级一次、可恢复错误只记录。
- Worker 测试：HTML SSR、静态资产透传、404、HEAD、SSR 异常和超时 CSR 回退、安全响应头。
- 构建 Gate：浏览器产物非空且有 `index.html`；SSR 产物为 webworker bundle；最终目录含 `_worker.js`；静态资源路径为根路径。
- 质量 Gate：全仓相关测试、类型检查、生产构建、公开内容扫描、链接检查全部通过。
- 视觉 Gate：375、390、430、1440 像素无根级横向溢出，SSR 与水合后主内容一致。
- 预览 Gate：`/`、`/keepsakes`、`/performance`、`/evidence` 和未知路径的状态码、标题、渲染响应头正确；SSR 故障注入能够回到可用 CSR。
- Evidence 完成：决策、架构、时序、代码位置、真实预览截图和限制一致后，才允许请求生产发布确认。
