# Task 2 浏览器采集与可靠上报报告

## RED

- 新增失败测试确认导航、资源与 Long Task 采集器尚不存在。
- 失败测试确认 400 响应会被错误重排、503 可无限重试，且资源事件会抢在 LCP 前发送。

## GREEN

- 增加七段导航、六类资源、Long Task count/total/max/duration 采集。
- 事件时间戳使用 `Date.now()`；Web3 操作时长使用 `performance.now()`。
- 4xx（429 除外）丢弃；429/5xx 与网络失败最多三次尝试并使用非阻塞指数退避。
- Vitals、错误与 Web3 使用高优先级队列；资源使用低优先级队列；pagehide 循环排空批次。
- SDK 端点不会作为资源事件入队；错误事件按 type_error/network/timeout/unknown 分类。

## 验证

- `pnpm --filter @babysteps/web exec vitest run src/performance/client.test.ts src/performance/observers.test.ts src/performance/runtime.test.ts --reporter=dot`：12 passed。
- 对本任务 7 个文件执行 Biome 检查：通过。
- `pnpm --filter @babysteps/web typecheck`：本任务文件无报错；被 `web/src/App.tsx` 与 `web/src/main.tsx` 的并行未提交改动阻断。

## Commit

- `6c53f7a` (`feat: collect browser performance events`)。

## 风险

- 全量 Web TypeScript 检查需在 App/main 的并行改动修复后复跑。
