# BabySteps AWS 零增量成本维护（2026-09-21）

## 结论

本地维护阶段只修改 CI 合同与 Evidence，没有主动 workflow dispatch、AWS deploy 或 AWS 写操作。随后通过 PR #88 发布到 Cloudflare Git Integration，生产回读通过；整个发布没有启动 AWS 性能 Runtime。现有安全过期 schedule 继续执行读检查/空操作保护，不是本轮主动触发的性能运行。

- AWS Free Plan 为 `ACTIVE`，只读协调快照显示剩余 `$147.38`，有效期至 `2027-02-05`。这是日期化余额，不是后续云写操作的免费承诺。
- 共享 NAT 已通过另一次审核后的 CloudFormation Change Set 移除；当前 NAT Gateway 数量为 `0`。
- BabySteps Performance 当前没有活跃 Stack、ECS Cluster/Task、Lambda、API Gateway、SQS 或 CloudWatch Log Group 残留。
- 共享 RDS 状态为 `inaccessible-encryption-credentials`，视为终止阻塞；禁止恢复、PITR 或新建替代数据库。
- Run [`33370197607`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33370197607) 仍是最新真实历史性能证明；Runtime 已清理，公开页面只能使用 `historical-verified-snapshot`。

## 本地维护

GitHub Actions 已在本地更新到 Node 24 兼容主版本：

- `actions/checkout@v7`
- `actions/setup-node@v7`
- `actions/upload-artifact@v7`
- `aws-actions/configure-aws-credentials@v6`
- `pnpm/action-setup@v6`
- `docker/setup-qemu-action@v4`
- `docker/setup-buildx-action@v4`

新增合同测试会扫描所有 workflow，拒绝上述 Action 回退到旧主版本。工作流的触发器、OIDC 权限、区域、Stack 名称、45 分钟 TTL、`$0.20` 上限、清理顺序和零残留门禁均未改变。

## TODO 与阻塞边界

- [x] 本地升级 Node 24 兼容 Actions。
- [x] 保留 Run `33370197607` 作为历史验证，不把 `cost-sleep` 冒充 Live AWS。
- [x] 保留 2026-09-21 的性能项目零活跃残留和 NAT=0 历史快照，不冒充当前 AWS 状态。
- [x] commit / push / PR / Cloudflare deploy：PR #88 已合并为 main `5360c3e`；验证 Run `35810476221` 通过；生产部署 `d08d933c-412a-4400-96c4-604ab4d1bdb6` 与首页、Evidence、深链接回读通过。
- [x] 获取新鲜 AWS 只读资源快照：2026-09-23 已完成 17 个启用区域的 EC2/NAT/RDS/ECS 检查，并保存[盘点收据](../deployment/2026-09-23-aws-inventory-receipt.json)。2026-09-21 的 CLI 会话过期记录仍是当时的历史状态。
- [ ] `BLOCKED`：恢复或替换共享 RDS；无法证明零增量成本且违反终止资源边界。
- [ ] `BLOCKED`：触发 AWS Performance `start` 或创建付费 Runtime；即使有赠送额度，也不能把余额等同于零增量成本。安全过期 schedule 仅允许保持读检查/空操作与已授权运行的清理职责。

## 验证边界

截至 2026-09-21 发布时，本地测试证明 YAML 结构、版本合同和已有生命周期合同没有回归；GitHub hosted runner 已通过 PR 与 main 验证。当时没有远程派发 AWS 性能运行，也没有新鲜 AWS 只读快照，因此不能用发布验证证明当时的 AWS Runtime 或资源清理状态。

2026-09-23 补验：AWS 只读清单显示 BabySteps Performance 控制参数为 `cleanup_verified`，没有可停止的运行中 EC2、ECS 服务/任务或 NAT；共享 RDS 仍处于 `inaccessible-encryption-credentials`，不是 BabySteps 项目清理目标。本次补验没有启动性能 Runtime，也没有 AWS 写操作。详见上述盘点收据。
