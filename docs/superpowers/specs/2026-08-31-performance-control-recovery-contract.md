# BabySteps 性能控制恢复合同

## 目标

修复固定性能 Runtime 在 Origin Secret 权限失败后的清理与回调闭环，同时保持最小权限、固定资源边界和 AWS Free 计划保护。

## 已验证故障

- `start` Run `33422707125` 在固定栈创建完成后，因 deploy role 缺少精确 Origin Secret 的 `secretsmanager:GetSecretValue` 而停止，未推送镜像、未初始化 Schema、未发布 running 回调。
- `schedule` Run `33446754796` 误走需要 Origin Secret、ECS 镜像和 Schema 的清理路径，最终写入 `cleanup_required`。
- `idempotent-stop` Run `33447439938` 已通过零残留 Gate，但终止回调因定时 Run 与人工恢复 Run 的 `workflow_run_id` 竞争被 D1 以 409 拒绝。
- 失败固定栈和项目残留已由授权管理员精确删除；共享 Foundation、NAT、RDS、OIDC 与 artifact 保持受保护。

## 必须实现

1. deploy role 只允许对 `babysteps-performance-origin-control-*` 执行 `DescribeSecret` 与 `GetSecretValue`。项目 DB Secret 只保留 `DescribeSecret`，共享 Secret 不获得 `GetSecretValue`。
2. 持久化 `databaseState`，值严格限定为 `before-database-access`、`schema-initialized`、`schema-cleanup-verified`。
3. `before-database-access` 的 stop/expiry 跳过 Origin Secret、聚合、ECS Schema cleanup，直接删除精确固定栈并执行零残留 Gate。
4. 回调使用持久化的 expected predecessor workflow Run 作为控制面 lineage；实际发送 Run 仍由 delivery id 和 Evidence 记录，不放宽 operation、generation、HMAC 或时间窗。
5. 覆盖 start 权限失败、before-db cleanup、schedule/manual race、idempotent stopped callback 与 zero residue 的合同测试。
6. 兼容旧 SSM 记录时只能使用可独立证明的状态：Stack 已不存在且旧 marker 为 `cleanup_verified` 时可迁移为 `schema-cleanup-verified`；Stack 仍存在或同一旧 operation 缺少 predecessor 时必须 fail-closed。首次 `idempotent-stop` 必须在回调前持久化 lineage。

## 硬边界

- 未收到新通知前不得 dispatch `start`、不得创建 Runtime 或收费资源。
- 不升级、取消或转换 AWS Free 计划。
- 不新增共享 VPC、NAT、RDS、ALB、OIDC、artifact 或日志基础设施。
- 不输出 Secret、Token、Cookie、私钥或未脱敏 ARN。
- 只允许代码、GitHub Actions 验证、Cloudflare Preview/Production 发布；发布不能作为 AWS Runtime 成功证据。
