# BabySteps 边缘渲染与故障降级证据

日期：2026-08-14

## 结论

BabySteps 已在本地完成并验证 `Cloudflare Edge SSR → React 精确水合 → 纯 CSR fallback` 的实现。它使用真实 URL 与 History API，不再用 hash 切换模拟页面；钱包、Privy、wagmi 和用户状态只在浏览器激活。本记录不宣称 Cloudflare preview 或 production 已上线。

## 作业要求 → 实现功能 → 代码位置 → 验证证据 → 当前状态

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 真实页面和深链 | BrowserRouter、九条路由、404 | `web/src/routing/` | 路由测试；built Worker 路由矩阵 | 本地已验证 |
| SSR 可读首屏 | React Web Streams + StaticRouter + server-safe 摘要壳 | `web/src/entry-server.tsx`、`web/src/app/ServerRouteShell.tsx` | SSR 单测；built Worker `/` 读回可读 HTML | 本地已验证 |
| 安全水合 | 白名单 state + 严格匹配后 hydrateRoot | `web/src/bootstrap.tsx`、`web/src/ssr/renderState.ts` | bootstrap 与序列化测试 | 本地已验证 |
| 失败降级 | SSR 异常/超时返回静态 HTML；致命水合失败最多一次 CSR | `web/src/pages-worker.ts`、`web/src/bootstrap.tsx` | error、timeout、one-shot fallback 测试 | 本地已验证 |
| 双端交付 | client + `_worker.js` 双构建、route manifest | `web/scripts/build-pages.mjs`、`web/public/rendering-manifest.json` | 生产 build；产物非空检查 | 本地已验证 |
| Cloudflare 预览 | deployment-specific URL、TLS、深链与浏览器水合 | 尚未执行外部发布 | 暂无云端 URL | 待验证 |

## 本地验证事实

- Web 测试：42 个测试文件、216 项通过。
- TypeScript：Web typecheck 通过。
- 双端生产构建：`web/dist/index.html` 4,818 bytes；`web/dist/_worker.js` 560,008 bytes。
- built Worker Gate 直接执行 4 条运行矩阵：`/evidence` 200、`/profile/` 200 且 `private,no-store`、`/missing` 404、`/api` 保持静态绑定 404；SSR 文档包含 `x-babysteps-render-mode: ssr`。
- fallback 测试覆盖：SSR 创建失败、读流中途失败、读流超时/abort、纯 CSR 静态根节点、路径/版本陈旧拒绝水合、recoverable hydration mismatch、致命错误最多一次 CSR 重挂载。
- 隐私测试覆盖：状态只允许 `mode / pathname / version`，拒绝额外用户字段，并转义 HTML/script 敏感字符。
- 真实浏览器：`/evidence` 根节点保持 `data-render-mode=ssr`，安全状态为 `mode/pathname/version`，控制台无 error/warn。
- 深链：从 Evidence 点击“个人中心”后 URL 变为 `/profile`；直接刷新仍返回 `data-render-mode=ssr` 并显示个人中心。
- 响应式：375、390、430、1440 四个视口的 `scrollWidth` 均等于 viewport width，横向溢出为 0。
- 截图：桌面端 166,349 bytes，SHA-256 `d65cd50e6ef8dbad9a21d1a6349dbbdb331fb5791c54ca848f8afb9f6d7b5f47`；390 手机端 73,265 bytes，SHA-256 `f19910c676d15c2d4c0a45abe544490e9cf84462bf8e962f62adf3bba1c2314b`。

## 设计取舍

1. 没有继续使用纯 CSR 作为唯一模式，因为 Evidence 和公开内容在脚本失败时应仍可读。
2. 没有把前端 SSR 移到 AWS，因为当前产品已由 Cloudflare Pages 交付，迁移会复制 CDN、TLS、路由和费用边界。
3. 没有给所有页面灌入个性化 SSR 数据；钱包、余额、会话和交易仍然是 client-only，避免私有状态进入共享缓存或 HTML。
4. 没有把 SSG/岛屿化写成已实现；当前真实组合是 Edge SSR、hydration、client activation 和 pure CSR fallback。

## 费用与保护边界

- 本节点没有 AWS 写操作，也没有创建 Lambda@Edge、CloudFront、API Gateway 或新数据库。
- AWS 增量成本 `$0`。
- 既有共享 VPC、NAT、RDS、OIDC、artifact bucket 和性能观测资源不属于本节点清理范围。
- Cloudflare preview 与 production 发布均未在本记录生成时执行。

## 应反向优化的共享能力

本项目已真实发现并验证两项可泛化规则：一是 History Router 的资源根路径必须由交付契约决定，不能对所有项目强制 `./`；二是渲染 Gate 必须执行构建后的 Worker，覆盖尾斜杠、真实 404、API 直通、client-shell 缓存与服务端 bundle 的浏览器 SDK 隔离。BabySteps 已完成“项目发现 → 泛化判断”并在本地 Gate 落地；共享 standard、TC Flow、本地/远端共享 Gate 与旧项目回归由共享方案任务接续，尚未发布前不标记为完成。项目专属的 Privy、wagmi 和路由名称不会进入通用规则。

## 架构与时序

- `docs/architecture/starbuddy-rendering-global-architecture.svg`
- `docs/architecture/starbuddy-rendering-resilience-sequence.svg`
- `docs/architecture/starbuddy-web3-architecture.mmd` 的“边缘 SSR、水合与 CSR 降级”章节

## 限制与下一步

下一步必须在真实 Cloudflare preview 验证：首页与深链返回正确状态码、静态资源直通、浏览器无 hydration mismatch、脚本禁用时公开内容仍可读、375/390/430/1440 响应式以及 TLS。完成前，Dashboard 标签必须保持 `cloud preview: pending`。

本机 `127.0.0.1` 访问个人中心时，Privy iframe 会因该临时 origin 不在正式域名白名单而重试；它不影响 SSR、水合或深链，但 Privy 登录只能在已配置的正式/预览 origin 做最终验收。
