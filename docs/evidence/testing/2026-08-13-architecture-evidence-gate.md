# 架构图片与 Evidence Gate 验收

日期：2026-08-13

## 目标与实现映射

| 作业要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 交付可放大的完整架构图 | 生成 1600 × 1000 的 StarBuddy 主题 SVG，覆盖用户请求、Cloudflare/D1、Sepolia、外部 RPC/索引、CI/CD、AWS、安全与清理边界 | `docs/architecture/starbuddy-web3-global-architecture.svg` | SVG 可解析；16,324 字节；SHA-256 见资产清单；桌面与手机截图均来自本地生产构建 | 已实现并验证 |
| 交付关键业务时序图 | 生成 1600 × 1000 的 SVG，串联 Provider 提交、Owner 审核、VRF、approve → buy → transferFrom、完成确认、SBT 与独立读回 | `docs/architecture/starbuddy-web3-business-sequence.svg` | SVG 可解析；11,056 字节；失败路径覆盖哈希冲突、VRF pending、授权失败、Relayer 重试与索引降级 | 已实现并验证 |
| Evidence 页面友好展示图片 | 两张独立图卡带准确替代文本、图注、“看哪里 / 证明什么”和原图链接；窄屏仅图片容器内部可横向查看 | `web/src/pages/EvidencePage.tsx:30`、`web/src/styles.css:1666` | `web/src/App.test.tsx:409`；390 px 根页面无横向溢出；1440 px 图片完整展开 | 已实现并验证 |
| 本地 Gate 阻止缺图或假图 | Gate 同时检查架构必备章节、状态标记、flowchart/sequenceDiagram、Evidence 页面文字、两张真实且非空的 SVG | `scripts/validate-delivery-evidence.mjs:13`、`scripts/validate-delivery-evidence.test.mjs` | TDD RED 先出现 4 项失败；实现后专项 10/10 通过；`pnpm validate:delivery-evidence` 通过 | 已实现并验证 |
| GitHub Gate 采用相同规则 | 复用组织级验证工作流，并把本地 Evidence 校验命令作为远端必跑输入 | `.github/workflows/verify-baby2b-project.yml:18`、`.github/workflows/verify-baby2b-project.yml:28` | 工作流静态契约与本地命令一致；本轮未推送，因此远端新提交仍待运行 | 已实现，远端待验证 |

## 图片资产清单

| 文件 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| `starbuddy-web3-global-architecture.svg` | 1600 × 1000 | 16,324 | `35122e6d9df68d9ba56e4843d84664e2d8506641168b38dd3e7d24e9a06c3963` |
| `starbuddy-web3-business-sequence.svg` | 1600 × 1000 | 11,056 | `b218c409cb8daa5fdc0d69d28ffd1599cbd6462254a41b7d52c83ab656b7648e` |
| `evidence-architecture-desktop-1440.jpg` | 1440 × 900 | 173,393 | `939fc0cb6c53f805fdd5544365fce7c8a059f9d794f1089c62fa811aba00d5bf` |
| `evidence-architecture-mobile-390.jpg` | 390 × 844 | 59,199 | `5a72d9623413823c69e118b02628afe49ca38678976ea6d1c75a58c3604a682c` |

## 看哪里，证明什么

### 1440 px 桌面 Evidence

![1440 px 下的 BabySteps 全局架构图片](../screenshots/2026-08-13-architecture-gate/evidence-architecture-desktop-1440.jpg)

- 看哪里：全局架构图完整显示在 Evidence 卡片中，图外紧邻阅读提示和状态说明。
- 证明什么：用户不必阅读 Mermaid 源码，也能直接查看真实图片；桌面端不需要缩小文字或横向滚动。

### 390 px 手机 Evidence

![390 px 下的 BabySteps 全局架构图片](../screenshots/2026-08-13-architecture-gate/evidence-architecture-mobile-390.jpg)

- 看哪里：卡片宽度贴合手机，SVG 仍保持可读比例；需要查看右侧节点时只滚动图片框。
- 证明什么：根页面 `scrollWidth === clientWidth === 390`，图片细节没有被强行压成不可读的小字，也不会造成整站横向溢出。

## 参考项目取长补短

参考公开项目 `yue3694/x-web3` 的结构化表达方式：把全局边界和业务时序分开、明确环境 RPC、清楚标出价格预言机的职责。BabySteps 保留自己的真实差异：Cloudflare Worker/D1、Chainlink VRF 随机任务、Uniswap v3、The Graph、三源 RPC 读回和 ERC-5192 SBT。

明确没有照搬 Foundry、固定 Sale 合约、EC2 单机 PostgreSQL/Redis 或对方的图片与部署拓扑。BabySteps 的图只展示仓库中真实存在的实现；AWS Relayer 等尚未云端验证的内容继续标为计划或待验证。

## 验证记录与限制

- 前端回归：28 个测试文件、164 项测试通过。
- 前端生产构建：通过，并把两张 SVG 作为带内容哈希的静态资产打包。
- Evidence 专项 Gate：10/10 通过；真实文件存在且字节数大于 0。
- 响应式实测：390 px 与 1440 px 均无根级横向溢出；390 px 的图片框提供内部横向查看。
- 本轮只完成本地实现与证据，没有执行生产部署，也没有把 GitHub 远端运行写成已完成。
- 非阻塞限制：Privy 依赖仍有大分包警告；AWS KMS Relayer 云端闭环和可选 IPFS pin 仍按实际状态标注。
