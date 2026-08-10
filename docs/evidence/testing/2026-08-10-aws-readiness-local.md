# AWS readiness local Evidence — 2026-08-10

## 结论

BabySteps 的 AWS readiness 路径已完成本地实现与验证：VPC/NAT/RDS/API/Lambda/KMS 运行时模板、GitHub OIDC/S3/CodeBuild bootstrap、HMAC 防重放、PostgreSQL 幂等作业、KMS EIP-1559 签名和 Lambda handler 均有真实代码与自动化测试。

**本次没有调用 AWS API，没有创建、更新、启动、停止或删除任何 AWS 资源，也没有产生可归因于本次操作的 AWS 用量。** 云端地址、ARN、日志、截图、CodeBuild ID 和完成交易均标记为 pending，不以本地结果代替。

## 实现与证明矩阵

| 能力 | 实现位置 | 本地证明 | 状态 |
| --- | --- | --- | --- |
| VPC / 2 AZ / 单 NAT / 私有 RDS | `aws/template.yaml` | `aws/test/template.test.ts`；SAM lint | local verified / cloud pending |
| HMAC、5 分钟窗口、nonce 防重放 | `aws/src/auth/webhook.ts` | `aws/test/webhook.test.ts` | local verified |
| completion job 与 nonce hash | `aws/src/repositories/postgresCompletionJobs.ts` | `aws/test/completionJob.test.ts`、`aws/test/postgresContract.test.ts` | local verified |
| 幂等 schema 初始化 | `aws/src/repositories/schema.ts`、`aws/migrations/0001_completion_jobs.sql` | `aws/test/schema.test.ts` | local verified |
| 不可导出 KMS Ethereum signer | `aws/src/signing/kmsEthereumSigner.ts` | 固定公开 SPKI/DER 夹具；`aws/test/derSignature.test.ts`、`aws/test/kmsEthereumSigner.test.ts` | local verified / KMS pending |
| Relayer 应用与 HTTP 边界 | `aws/src/application/confirmCompletion.ts`、`aws/src/handler.ts` | `aws/test/confirmCompletion.test.ts`、`aws/test/handler.test.ts` | local verified / API pending |
| OIDC、S3、CodeBuild 与付费 gate | `aws/bootstrap.yaml`、`aws/buildspec.yml`、`.github/workflows/aws-readiness.yml` | `aws/test/bootstrap.test.ts`、`scripts/validate-aws-readiness.test.mjs` | local verified / bootstrap pending |

## 已执行门禁

以下结果来自本地命令的成功退出状态：

- `pnpm --filter @babysteps/aws test`：11 个测试文件，39 项测试通过。
- `pnpm --filter @babysteps/aws typecheck`：通过。
- `pnpm --filter @babysteps/aws check`：通过。
- `sam validate --lint --region us-east-1 --template-file aws/bootstrap.yaml`：通过。
- `sam validate --lint --region us-east-1 --template-file aws/template.yaml`：通过。
- `pnpm --filter @babysteps/aws build`：通过；SAM/esbuild 生成非空 `handler.js`。构建目录被 `.gitignore` 排除，不作为源码或公开 Evidence 提交。
- `pnpm test:validators`：9 项 validator 测试通过。
- `pnpm validate:aws-readiness`：`AWS readiness pipeline contract: ok`。

## 安全与费用约束

- GitHub workflow 不读取长期 AWS Access Key；OIDC `sub` 限定为 `repo:Tiancheng-Xu/babysteps:environment:aws-readiness`。
- 工作流没有 `push`、`schedule` 或 webhook 触发；只能手动 dispatch。
- CodeBuild `BUILD_GENERAL1_SMALL`、并发上限 1；S3 源码版本 7 天过期。
- `ALLOW_AWS_PAID_DEPLOYMENT=true` 必须在 GitHub Environment 审批后的 job 中显式覆盖，buildspec 才会越过 `sam deploy` 前门禁。
- RDS 禁止公网访问；数据库安全组只接受 Relayer 安全组的 5432；Lambda 只有 HTTPS/RDS 出站。
- KMS 密钥为 `ECC_SECG_P256K1`/`SIGN_VERIFY`；Lambda 权限限定 `GetPublicKey` 与 `Sign`；代码使用 `MessageType=DIGEST`，不保存私钥。
- NAT Gateway、公有 IPv4/EIP、RDS、Secrets Manager、KMS、CodeBuild 运行分钟和日志在云端启动后可能计费；未在本地 Evidence 中承诺免费。

## 可追溯提交

- `c789001` — AWS runtime SAM 基础模板。
- `c30e869` — webhook HMAC 与 replay gate。
- `26e1558` — PostgreSQL 幂等作业。
- `a95ad0d` — KMS Ethereum signer。
- `ae51470` — Lambda completion relayer。
- `6bf91bd` — OIDC/S3/CodeBuild 付费部署门禁。
- `bc7b348` — 幂等数据库 schema 初始化。

## 云端待验证

1. bootstrap Stack、OIDC provider 选择、S3 bucket、CodeBuild project 和 IAM 实际权限。
2. runtime Stack 的 VPC、NAT/EIP、RDS、Secrets、API、Lambda、KMS 和日志。
3. API→Lambda→RDS、Lambda→NAT→Sepolia、KMS 地址与 `COMPLETION_RELAYER_ROLE`。
4. 一笔受控 V2 `confirmCompletion` 交易、回执、证书和独立 RPC 复核。
5. 完整 Evidence 通过后生成精确费用与清理清单；可逆停用优先，永久删除前再次确认。
