# Web3 external-service screenshots — 2026-08-12

这些截图用于证明外部开发服务的真实配置结果，不是逐次点击流水账。只保留会改变验收结论的节点；API Key、RPC URL、邮箱和完整钱包信息不进入截图或仓库。

| 截图 | 操作目的与设计理由 | 可见验证结论 | 安全处理 |
| --- | --- | --- | --- |
| `alchemy-app-free-usage.png` | 证明 Alchemy 没有升级或启用付费容量 | 应用为 `babysteps-sepolia`；Active Plan 为 Free；当月 CU 使用为 0 | 未显示 API Key、RPC URL 或账号邮箱 |
| `alchemy-ethereum-sepolia-only.png` | 验证唯一启用网络确为 Ethereum Sepolia，而不是只相信汇总数字 | 1 个网络启用、157 个禁用；Ethereum Sepolia 为 Enabled，同组其他网络为 Disabled | RPC URL 列整列遮挡，未包含凭据 |
| `infura-sepolia-only-safe.png` | 将 Infura 免费 Key 收敛为 Sepolia 专用，减少误用其他网络的额度和攻击面 | 46 个网络中仅 Ethereum Sepolia 启用 | 画面裁掉 Key、Secret、Endpoint 与账号区域；截图中曾出现的旧 Key 已旋转失效 |
| `infura-core-free-plan.png` | 证明 Infura 没有升级或启用收费套餐 | Current Plan 为 Core；Estimated Monthly Charge 为 Free | 未显示付款方式、账号邮箱或凭据 |
| `the-graph-sepolia-synced.png` | 证明合约日志已真实发布到 Subgraph Studio 并完成索引 | `v0.1.0`、Ethereum Sepolia、Deployed、Synced、100%、9 entities | Studio 对 deploy key 和钱包使用截断显示；仓库不保存完整值 |
| `privy-allowed-origin.png` | 将 Privy 客户端访问范围锁定到正式产品域名，防止其他站点滥用公开 App ID | Allowed origin 包含 `https://babysteps.baby2b.online`；应用仍为免费 development mode | 未打开 API keys 页；截图不含 App Secret、邮箱或用户数据 |

对应的机器可读证据：

- `docs/evidence/deployment/2026-08-12-the-graph-sepolia.json`
- RPC 三源对照证据将在 Infura/Alchemy 端点完成安全注入并实际读取后补充，未验证前不写作完成。
