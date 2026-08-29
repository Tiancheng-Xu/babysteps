# BabySteps 性能观测 AWS 精确恢复与清理

日期：2026-08-29

状态：清理已验证

源 Run：`33232356133`

## 有效运行证据

- 受控浏览器走读覆盖 `/`、`/tasks`、`/profile`、`/performance`、`/evidence`，形成 25 个批次、415 个浏览器事件。
- 一次性 ECS Cleaner 成功写入 103 条事件；清理前仍有 80 条 SQS 可见消息，因此不宣称全量排空。
- 数据库 Schema 已删除并完成不存在性验证。
- 原 Run 在 Stack 删除等待阶段取消，Artifact 未上传；两次固定 Recovery Run `33234792940`、`33236950502` 也在有界等待后停止，不能据此宣称零残留。最终 Recovery Run `33244161458` 在精确解除 ENI 阻塞后成功，并产出零残留 Artifact `9712312154`。

## 删除阻塞根因

CloudFormation 的 23 个项目资源中已有 22 个删除完成，剩余逻辑资源为 `RuntimeSecurityGroup`。真实只读诊断确认：

- Stack 与 Security Group 都带有 `Project=babysteps-performance`、`RunId=33232356133` 的双重所有权标签。
- 唯一依赖是 Query Lambda 创建的 VPC ENI；它处于 `available`，无 Attachment，且不是 AWS 托管 ENI。
- 精确 Query Lambda 已不存在，其他 Lambda 使用该 Security Group 的数量为 0，匹配 ECS Cluster 为 0，其他 Security Group 引用为 0。
- CloudTrail 证明该 ENI 由角色 `babysteps-performance-query-e33232356133` 使用本 Run Security Group 创建；同一角色随后进行了 10 次失败删除。
- 公开 Evidence 不发布 ENI、Security Group、账号或私有网络的完整标识。

## 已批准并完成的精确清理

用户已在 2026-08-29 明确批准：删除已证明属于 Run `33232356133` 的无挂载孤儿 ENI，然后重试删除 Stack `babysteps-performance-33232356133`。

清理不包含且不得触碰：共享 VPC/子网、NAT、PostgreSQL、GitHub OIDC、Artifact Bucket、`tc-course-shared-foundation`、`tc-course-shared-identity`。

执行结果：孤儿 ENI 删除后完成不存在性读回；CloudFormation 使用 Stack 原绑定的 execution role 重试并确认 Stack 不存在。最终 GitHub Actions Recovery Run：<https://github.com/Tiancheng-Xu/babysteps/actions/runs/33244161458>，head `798f5570ce41b97bba13efcbfb2d09c5657cf0da`。

## 最终零残留证据

Artifact `9712312154` 的 `recovery-cleanup.json` 记录：

- `cloudFormationStackAbsent=true`
- `remainingProjectResources=0`
- ECR、ECS Cluster/Task/Task Definition、SQS/DLQ、API Gateway、Lambda、CloudWatch Log Group、Secrets、Security Group/Ingress、IAM Role 全部为 0
- 共享 VPC、NAT、数据库、OIDC、Artifact Bucket 为 `protected-read-only`，Foundation 为 `explicit deny cleanup`

补充本地只读盘点中，Resource Groups Tagging API 仍短暂返回 1 个 `INACTIVE` ECS Cluster 与 2 个 `DELETE_IN_PROGRESS` Task Definition 墓碑；ECS 原生活跃清单和官方 Recovery Artifact 均为 0，因此它们是无运行费用的最终一致性控制面记录，不是活跃 Runtime。

## 全区域、共享资源与费用读回

- 已扫描全部 17 个启用 Region；exact Stack/ENI/ECR/ECS/Task Definition/SQS/API Gateway/Lambda/Logs/Secrets/Security Group 的活跃项目资源总数为 0，非零活跃 Region 为 0；全局项目 IAM Role 为 0。
- 共享 Foundation Stack=`CREATE_COMPLETE`，Identity Stack=`UPDATE_COMPLETE`，共享 NAT 与 PostgreSQL 均为 `available`；共享数据库 Security Group、GitHub OIDC Provider 与 Artifact Bucket 仍存在。
- AWS Budget 月上限为 40 USD，本次即时读数为 26.085 USD，Forecast 暂不可用。账单存在传播延迟，应在 24–48 小时后再做一次费用复核。

## 完成 Gate

以下条件均已满足，因此本文与机器可读回执更新为“清理已验证”：

1. 精确 ENI 不存在；
2. 精确 CloudFormation Stack 不存在；
3. ECR、ECS Cluster/Task/Task Definition、SQS/DLQ、API Gateway、Lambda、CloudWatch Log Group、Secrets、Security Group/Ingress、IAM Role 的项目级读回均为 0；
4. 共享资源保持存在且未修改；
5. 记录即时成本边界，并建议在 24–48 小时后复核账单滞后。

机器可读回执：`docs/evidence/deployment/2026-08-29-performance-aws-recovery.json`
