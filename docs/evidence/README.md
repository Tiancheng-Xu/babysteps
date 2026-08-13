# BabySteps Web3 工程证据

此目录用于保留 BabySteps 从原有成长记录产品扩展到 Web3 成长任务市场的可复核过程。证据只陈述已完成事实，并用公开测试网地址、交易哈希和独立 RPC 复核结果支持结论。

## 学习路径

1. 从 [`../architecture/starbuddy-web3-global-architecture.svg`](../architecture/starbuddy-web3-global-architecture.svg) 理解用户运行时、Cloudflare 链下数据、Sepolia、外部读取、CI/CD、AWS 与清理边界。
2. 从 [`../architecture/starbuddy-web3-business-sequence.svg`](../architecture/starbuddy-web3-business-sequence.svg) 沿 1–9 步理解 Provider 提交、Owner 审核、VRF、精确授权购买、完成、SBT 和独立读回。
3. 从 [`../architecture/starbuddy-web3-architecture.mmd`](../architecture/starbuddy-web3-architecture.mmd) 查看两张图片背后的工程真相源和状态说明。
4. 从 [`testing/2026-08-09-validation.md`](testing/2026-08-09-validation.md) 理解测试门禁如何保护代币、随机任务、购买和证书规则。
5. 从 [`testing/2026-08-13-architecture-evidence-gate.md`](testing/2026-08-13-architecture-evidence-gate.md) 核对两张图片、响应式截图、SHA-256 与本地/仓库 Gate。
6. 从 [`deployment/2026-08-09-sepolia.md`](deployment/2026-08-09-sepolia.md) 查看 Sepolia 合约、角色、VRF Subscription 与恢复过程的完整证明。
7. 从 [`ui/README.md`](ui/README.md) 对照 Stitch 设计与实际实现，确认桌面和移动端都没有横向页面溢出。

## 证据目录

- `architecture/`：StarBuddy 主题的全局架构图片、业务时序图片与 Mermaid 工程真相源。
- `testing/`：执行命令、通过数量和已知非阻塞警告。
- `ui/`：关键页面与响应式验收截图。
- `deployment/`：本地部署记录与 Sepolia 上链证据清单。

## 真实性边界

- 当前合约与 UI 已通过本地测试、类型检查和生产构建。
- 本地 Hardhat 地址是临时开发地址，不能当作公开测试网部署证明。
- BabyCoin、GrowthActivities、GrowthCertificate 与 TaskMarketplace 已部署到 Ethereum Sepolia；源码验证仍待配置 Etherscan API key。
- 角色授权、VRF Consumer、真实任务请求、随机数回调、购买和证书铸造已完成；对应交易与读回记录位于 `deployment/`。
