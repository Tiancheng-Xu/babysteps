# BabySteps 设计系统性能对比

## 结论

本轮只验证设计系统与前端查询切片，没有启动 AWS Runtime，也没有把实验室结果冒充真实用户监控。精确基线 `230b24df3909d3ee2c7081897052f1610bd65f20` 与候选合同 `5c52084af1481b488287e7251bbb48fd2ed36d19364585241dc10b700bc98506` 在同一台机器、同一 Chromium 和同一条件下各采样 3 次；候选没有出现可复现的加载、交互、布局稳定性或长任务回退。

这是 `local-lab / controlled-browser / n=3` 的低置信度对比，只能作为发布 Gate，不能代表生产 Field RUM。

## 冻结条件

- 浏览器：Chromium 140.0.7339.16，无头模式。
- 视口：1440 × 1000，DPR 1，浅色模式，减少动态效果。
- Locale / 时区：`zh-CN` / `UTC`。
- 路由：冷启动 `/`；代表性交互 `/` 点击“成长任务”进入 `/tasks`。
- 缓存：每个样本使用全新 BrowserContext；冷启动禁用浏览器缓存。
- CPU / 网络：无节流、本机 loopback。
- 外部字体：基线与候选均阻断 `fonts.googleapis.com` 和 `fonts.gstatic.com`，使用相同系统回退字体，避免第三方网络抖动污染前后对比。此条件不表示生产已移除 Google Fonts。
- 每侧保存 1 份冷启动 Chrome DevTools Protocol trace、1 份代表性交互 trace、2 张截图和完整原始指标 JSON。

## 前后指标

| 指标 | 口径 | 基线 p75 | 候选 p75 | 变化 |
| --- | --- | ---: | ---: | ---: |
| TTFB | Navigation Timing，本机服务 | 1.3 ms | 1.7 ms | +0.4 ms |
| FCP | Paint Timing | 212 ms | 216 ms | +4 ms |
| LCP | Largest Contentful Paint | 212 ms | 216 ms | +4 ms |
| CLS | 无近期输入的 Layout Shift 累计 | 0 | 0 | 0 |
| Long Task 总时长 | Long Tasks，单次页面 | 0 ms | 0 ms | 0 ms |
| Event Timing | 代表性交互的最大 interaction duration | 24 ms | 24 ms | 0 ms |
| 自动化交互闭环 | Playwright 点击、懒加载并显示“成长任务市集”主标题后到下一帧，诊断值 | 959.1 ms | 943.2 ms | -15.9 ms |

该页面当前同一次观测中 FCP 与 LCP 相同，是因为首个绘制内容同时也是该次加载的最大内容元素；它们的定义并不相同，不能据此合并两个指标。候选的 FCP/LCP p75 比基线高 4ms、TTFB 高 0.4ms，处于本机 `n=3` 低置信度噪声范围，不能宣称退化或优化。

## 确定性结果

- baseline pageerror：0；candidate pageerror：0。
- baseline / candidate CLS p50、p75、p95：均为 0。
- baseline / candidate Long Task p75：均为 0 ms。
- 候选 JS 总 gzip 相对精确基线增加 129B；最大路由增量为 Provider 132B，低于 30KiB Gate。

## 机器证据

- [基线指标](design-system-performance/baseline-230b24d-metrics.json)
- [候选指标](design-system-performance/candidate-5c52084a-metrics.json)
- [基线冷启动 trace](design-system-performance/baseline-230b24d-cold-load-trace.json.gz)
- [候选冷启动 trace](design-system-performance/candidate-5c52084a-cold-load-trace.json.gz)
- [基线交互 trace](design-system-performance/baseline-230b24d-interaction-trace.json.gz)
- [候选交互 trace](design-system-performance/candidate-5c52084a-interaction-trace.json.gz)
- [基线冷启动截图](design-system-performance/baseline-230b24d-cold-load.png)
- [候选冷启动截图](design-system-performance/candidate-5c52084a-cold-load.png)
- [基线交互截图](design-system-performance/baseline-230b24d-interaction.png)
- [候选交互截图](design-system-performance/candidate-5c52084a-interaction.png)
