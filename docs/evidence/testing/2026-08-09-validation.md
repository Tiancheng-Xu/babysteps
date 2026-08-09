# 2026-08-09 本地验证记录

## 验证范围

本轮验证覆盖新 Web3 合约、原有链上便签功能、新导航与产品页面，以及生产构建和公开文案门禁。

## 已通过

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 仓库自动测试 | `pnpm test` | 50 项合约/部署测试、147 项前端自动测试通过 |
| 类型检查 | `pnpm typecheck` | contracts 与 web 通过 |
| 生产构建 | `pnpm build` | Hardhat 编译与 Vite 构建通过 |
| 页面视觉检查 | 本地 Vite + 1024px/390px 视口 | 关键页面无页面级横向溢出 |

## 测试覆盖重点

- BabyCoin：测试铸币不增加 lifetimeEarned；活动奖励才增加累计成长；转账不改变累计成长。
- GrowthActivities：3/5/7 BABY、随机冷却范围、UTC+8 每日上限。
- TaskMarketplace：Provider 权限、VRF 一次锁定、暂停、approve → buy → transferFrom、单钱包单任务。
- GrowthCertificate：Oracle 完成确认后每笔购买只铸造一张可转移 ERC-721。
- Web3 UI 适配：可选部署地址严格校验；最多读取最近 50 个任务；失败的 RPC 结果不替换为假数据。
- Provider 上架：真实读取 PROVIDER_ROLE，模拟并提交 createTask，receipt 确认后才显示成功。
- BabyCoin 成长面板：分别读取可用余额、累计活动奖励、阶段和三个活动额度；活动交易确认后刷新全部六项数据。
- 购买状态机：精确额度授权与购买分别签名、分别等待 receipt，并保留两笔交易哈希。
- UI：五个产品视图可访问，未部署状态不展示伪造链上数据，架构图可加载。

## 已知非阻塞项

`prefers-reduced-motion` 中 4 个既有 `!important` 会产生 Biome warning，用于确保减少动态效果偏好覆盖动画；不影响构建和测试。

此记录不代替 CI 日志。推送后应把 GitHub Actions 运行链接追加到部署证据目录。
