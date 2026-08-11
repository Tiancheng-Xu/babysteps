# AWS 可暂停阶段本地 Evidence — 2026-08-10

## 结论

BabySteps 已把 AWS 作业拆成两个互不混淆的阶段：

1. **当前允许部署的可暂停阶段**：隔离 VPC、两可用区私有子网、私有 Single-AZ RDS、自动停库 Lambda、5 分钟 EventBridge 保护、直接调用的 Readiness Lambda，以及手动触发的 OIDC/S3/CodeBuild。
2. **明确延后的持续计费阶段**：NAT Gateway、EIP/公有 IPv4、客户管理 KMS、Secrets Manager 和生产 Relayer。当前 CodeBuild 权限与 buildspec 均不能创建这些资源。

本文件记录部署前本地门禁；2026-08-11 云端闭环已经完成，真实 Stack、CodeBuild、网络、IAM、Lambda 与 RDS 停库证据见 [`../deployment/2026-08-11-aws-pausable.md`](../deployment/2026-08-11-aws-pausable.md)。

## 实现与证明矩阵

| 能力 | 实现位置 | 本地证明 | 状态 |
| --- | --- | --- | --- |
| 无公网出口的 VPC / 2 AZ 私有子网 | `aws/pausable-template.yaml` | `aws/test/pausable-template.test.ts`；SAM lint | local + cloud verified |
| 私有 RDS PostgreSQL | `aws/pausable-template.yaml` | `db.t4g.micro`、20 GB gp3、Single-AZ、无公网、无备份、无 ingress 合同测试 | local + cloud verified / stopped |
| 创建后及 7 天自动重启后的停库保护 | `StopDatabaseFunction`、`StopDatabaseSchedule` | `rate(5 minutes)`、仅目标 DB 的 `StopDBInstance` 权限测试 | local + cloud verified |
| 私有健康探针 | `ReadinessProbeFunction` | 模板资源合同、SAM lint、直接 invoke 返回 200 | local + cloud verified |
| OIDC、S3、CodeBuild 手动部署 | `aws/bootstrap.yaml`、`aws/buildspec.yml`、`.github/workflows/aws-readiness.yml` | `aws/test/bootstrap.test.ts`、`scripts/validate-aws-readiness.test.mjs` | bootstrap + direct CodeBuild verified；GitHub workflow pending |
| 持续计费资源拒绝门禁 | `scripts/validate-aws-readiness.mjs` | NAT/EIP/KMS/Secrets/full-template 负向测试 | local verified |
| 完整 Relayer 参考实现 | `aws/template.yaml`、`aws/src/**` | HMAC、PostgreSQL 幂等、KMS signer、handler 单元测试 | local verified / deployment deferred |

## 已执行门禁

- `pnpm --filter @babysteps/aws test`：12 个测试文件，43 项测试通过。
- `pnpm test:validators`：12 项 validator 测试通过。
- `pnpm validate:aws-readiness`：`AWS readiness pipeline contract: ok`。
- `sam validate --lint --region us-east-1 --template-file aws/bootstrap.yaml`：通过。
- `sam validate --lint --region us-east-1 --template-file aws/pausable-template.yaml`：通过。
- `git diff --check`：通过。

## 费用与安全边界

- 可暂停模板没有 Internet Gateway、NAT Gateway、EIP、公有 IPv4、KMS key 或 Secrets Manager secret。
- RDS 创建后会由 5 分钟规则反复检查；仅在 `available` 时请求停止。AWS 最长停止 7 天后会自动重启，该规则会再次停库。
- **RDS 停止后仍收存储费**；自动停库只停止计算费用，不等于零费用。Stack 仍带 `ExpiresAt` 标签，最终复盘后应执行清理流程。
- 数据库密码由 CodeBuild 运行时随机生成，只以 CloudFormation `NoEcho` 参数传入；仓库、GitHub Secret 和 Evidence 都不保存密码。
- GitHub workflow 仅 `workflow_dispatch`；OIDC `sub` 限定 `repo:Tiancheng-Xu/babysteps:environment:aws-readiness`，不使用长期 Access Key。
- CodeBuild 仅 Small、并发 1；S3 源包 7 天过期。`ALLOW_AWS_PAUSABLE_DEPLOYMENT=true` 是唯一部署门禁。
- `CloudFormationExecutionRole` 已移除创建 NAT、EIP、KMS 和 Secrets Manager 的权限；buildspec 只允许 `aws/pausable-template.yaml`。

## 延后内容

以下内容需要用户再次确认持续费用后才可启动：NAT Gateway、EIP/公有 IPv4、客户管理 KMS、Secrets Manager、私网生产 Relayer，以及完整模板 `aws/template.yaml`。当前 GitHub Action 不能部署该模板。

## 云端验证结果

1. Bootstrap `UPDATE_COMPLETE`；Runtime `CREATE_COMPLETE`。
2. 两子网禁止自动公网 IP；路由表只有 local；IGW 与 NAT 查询均为空。
3. Readiness Lambda 直接调用返回 200；公开 API 因非作业硬需求被移除。
4. RDS 已由自动停库路径变为 `stopped`；EventBridge Rule 为 `ENABLED`。
5. GitHub OIDC 资源已创建，但 main 上的 Actions 端到端触发仍待分支合并/推送后验证。
