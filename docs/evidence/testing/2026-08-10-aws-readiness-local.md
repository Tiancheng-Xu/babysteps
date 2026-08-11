# AWS 可暂停阶段本地 Evidence — 2026-08-10

## 结论

BabySteps 已把 AWS 作业拆成两个互不混淆的阶段：

1. **当前允许部署的可暂停阶段**：隔离 VPC、两可用区私有子网、私有 Single-AZ RDS、自动停库 Lambda、5 分钟 EventBridge 保护、按请求计费的 HTTP API/Lambda，以及手动触发的 OIDC/S3/CodeBuild。
2. **明确延后的持续计费阶段**：NAT Gateway、EIP/公有 IPv4、客户管理 KMS、Secrets Manager 和生产 Relayer。当前 CodeBuild 权限与 buildspec 均不能创建这些资源。

本地代码、权限合同、测试和 SAM lint 已通过。**AWS 控制台连接超时且本机 CLI 没有 AWS 凭据，因此本次没有调用 AWS API，也没有创建、更新、启动、停止或删除云资源。** 云端 Stack ID、ARN、HTTP 地址、RDS 状态和 CodeBuild ID 均为 pending。

## 实现与证明矩阵

| 能力 | 实现位置 | 本地证明 | 状态 |
| --- | --- | --- | --- |
| 无公网出口的 VPC / 2 AZ 私有子网 | `aws/pausable-template.yaml` | `aws/test/pausable-template.test.ts`；SAM lint | local verified / cloud pending |
| 私有 RDS PostgreSQL | `aws/pausable-template.yaml` | `db.t4g.micro`、20 GB gp3、Single-AZ、无公网、无备份、无 ingress 合同测试 | local verified / cloud pending |
| 创建后及 7 天自动重启后的停库保护 | `StopDatabaseFunction`、`StopDatabaseSchedule` | `rate(5 minutes)`、仅目标 DB 的 `StopDBInstance` 权限测试 | local verified / cloud pending |
| 按请求计费的健康探针 | `ReadinessApi`、`ReadinessProbeFunction` | 模板资源合同与 SAM lint | local verified / cloud pending |
| OIDC、S3、CodeBuild 手动部署 | `aws/bootstrap.yaml`、`aws/buildspec.yml`、`.github/workflows/aws-readiness.yml` | `aws/test/bootstrap.test.ts`、`scripts/validate-aws-readiness.test.mjs` | local verified / bootstrap pending |
| 持续计费资源拒绝门禁 | `scripts/validate-aws-readiness.mjs` | NAT/EIP/KMS/Secrets/full-template 负向测试 | local verified |
| 完整 Relayer 参考实现 | `aws/template.yaml`、`aws/src/**` | HMAC、PostgreSQL 幂等、KMS signer、handler 单元测试 | local verified / deployment deferred |

## 已执行门禁

- `pnpm --filter @babysteps/aws test`：12 个测试文件，41 项测试通过。
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

## 云端待验证

1. AWS 登录恢复后创建 bootstrap 与 pausable runtime Stack。
2. 独立读取 VPC、子网、路由表和安全组，确认无公网路径。
3. 验证 `/readiness/health` 返回 200。
4. 等 RDS 到 `available` 后确认自动变为 `stopped`，记录 Stack ID、资源 ARN、日志和时间线。
5. 保存脱敏 Evidence 后执行到期清理；若选择保留，继续承担 RDS 存储费。
