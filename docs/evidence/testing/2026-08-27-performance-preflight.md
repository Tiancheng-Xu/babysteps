# Performance control read-only preflight

## 结论

2026-08-27 的最终生产只读预检 run
[`33122261763`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33122261763)
已经证明：GitHub OIDC 能取得 `babysteps-performance-deploy` 的短期 AWS 身份，
完整固定资源清单为零，且 `preflight` 不进入部署、删除、SSM 标记或控制面回调。

随后的真实闭环 run
[`33122381226`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33122381226)
在临时 Stack 创建阶段失败关闭。首个根因是 CloudFormation 执行角色未被允许为
`/aws/lambda/babysteps-performance-*` 创建日志组；回滚时同一角色又不能删除这两个
日志组，最终 Stack 为 `ROLLBACK_FAILED`，自动清理 Artifact 诚实标记为需要人工修复。
该 run 没有进入浏览器旅程、ECS 清洗或 PostgreSQL 查询，因此不能作为作业成功证明。

清理旧失败 Stack 并补齐 Lambda 日志生命周期权限后，run
[`33138167695`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/33138167695)
已经进入临时 Stack、迁移、受控采集与 Schema 清理；`schemaDeleted=true`、
`schemaAbsenceVerified=true`。但它仍失败关闭：Web 以开发配置启动导致真实 Chromium
页面在生产合约地址校验处停止，清理盘点缺少 `ecs:ListTasks`，Stack 删除后又缺少
`ecs:DeleteTaskDefinitions`。因此该 run 也只能作为根因与清理证据，不能标为完成。

## 已验证

- 首次 GitHub Actions run：`33037553599`
- 合并 PR #36 后的复验 run：`33099661089`，绑定 main commit
  `cf67d7e9617ac7463247c424a5a6aa93b424d390`
- 最终只读预检 run：`33122261763`，绑定 main commit
  `7c51eea1e71cec49044f3926120daca270b4ea34`
- `Validate untrusted control request`：通过
- `Configure short-lived AWS credentials`：通过
- `Resolve fixed action and expiry`：通过，动作是 `preflight`
- 部署、镜像推送、ECS Task、Schema、Stack 删除、SSM 与全部回调步骤：跳过
- 脱敏 Artifact：`oidcIdentityVerified=true`、`mode=read-only-preflight`、
  `cloudFormationStackAbsent=true`、`remainingRunnableProjectResources=0`
- 启动前项目资源清单：ECS Cluster/Task/Task Definition、CloudWatch Log Group、
  IAM Role 均为 `0`；共享 Foundation 仍受保护

## 首次真实闭环的失败关闭证据

- Run：`33122381226`；审批引用仅保存 SHA-256，不保存原文
- `Validate budget and source`、共享 Foundation Gate、制品构建：通过
- `Deploy temporary project stack`：失败
- 精确首因：`logs:CreateLogGroup` 对两个项目 Lambda 日志组返回 `AccessDenied`
- 精确清理阻塞：`logs:DeleteLogGroup` 返回 `AccessDenied`
- 未执行：浏览器受控旅程、ECS 清洗、PostgreSQL 聚合查询、Dashboard 回读
- 失败 Artifact：`cloudFormationStackAbsent=false`、
  `remainingProjectResources=-1`、`schemaCleanupCertain=false`、
  `manualRetryRequired=true`

`-1` 表示清理结果未知，不是“负一个资源”。在失败 Stack 与两个精确日志组删除、
重新完成零残留回读前，不允许触发第二次真实闭环。

## 第二次真实闭环的失败关闭证据

- Run：`33138167695`
- 已进入：临时 Stack、PostgreSQL 迁移、真实 Chromium 步骤、Schema 清理、Stack 删除
- 浏览器首因：Vite 未使用 production mode，页面因生产合约地址配置未加载而停止
- 清理盘点阻塞：项目临时 Cluster 的 `ecs:ListTasks` 返回 `AccessDenied`
- Task Definition 清理阻塞：精确临时 family 的 `ecs:DeleteTaskDefinitions` 返回
  `AccessDenied`
- Schema Artifact：`schemaDeleted=true`、`schemaAbsenceVerified=true`、`attempt=1`
- 最终 Artifact：因 IAM 无法完成零残留证明，诚实标记 `cleanup-incomplete`

本次修复坚持同源配置：受控浏览器使用 production mode，同时只显式允许
`localhost`、`127.0.0.1` 与 IPv6 loopback 的 HTTP；外部 HTTP 继续拒绝。浏览器脚本会
保存 5 条关键路由的桌面截图、完整旅程录屏，以及真实聚合回读后的桌面/390 px 手机
Dashboard 截图与录屏。失败输出只保留路由级错误码，不输出 URL、查询参数或 Token。

## 最小权限修复

`aws/iam/performance-control-readback-policy.json` 是独立附加策略，只包含零残留
Gate 所需读取动作，资源限制为 BabySteps 固定名称；必须使用 `Resource: "*"` 的
列表动作额外限制在 `us-east-1`。它不包含创建、更新、运行、停止、删除或
`iam:PassRole`。

PR [#37](https://github.com/Tiancheng-Xu/babysteps/pull/37) 已把代码与权限契约合并到
main commit `7c51eea1e71cec49044f3926120daca270b4ea34`：

- `lambda:GetFunction` 只允许两个固定项目函数；
- `ecs:ListTasks` 只允许 `us-east-1` 的固定性能集群；
- `ecs:ListTaskDefinitions` 只允许区域级只读枚举，并在代码中再次校验固定 family；
- 原来的全账户 `iam:ListRoles` 已移除，改为四个固定角色的 `iam:GetRole`；
- 仅 `NoSuchEntity`、`ResourceNotFoundException` 等服务明确“不存在”错误可判为无残留；
  `AccessDenied`、限流、网络和未知错误一律失败关闭。

共享身份 Stack 已在 2026-08-27 应用 canonical readback policy；规范化哈希一致，
正向 simulation `6/6 allowed`，完整反向 Gate `9/9`（3 条 `implicitDeny`、
6 条共享资源删除/更新 `explicitDeny`），Stack drift 为 `IN_SYNC`。这证明只读盘点
边界已经就绪，但不代表真实性能闭环成功。

`aws/iam/performance-evidence-lifecycle-policy.json` 进一步只允许：对
`babysteps-performance-e*` 临时 Cluster 做 `ecs:ListTasks`，以及删除
`babysteps-performance-cleaner-e*`、`babysteps-performance-db-admin-e*` 的临时 Task
Definition。2026-08-28 线上规范化 SHA-256 与仓库策略一致；正向 `3/3 allowed`，
跨项目 `2/2 implicitDeny`，共享 NAT/RDS/Foundation `4/4 explicitDeny`；身份 Stack
为 `UPDATE_COMPLETE`，drift 为 `IN_SYNC / 0`。这仍只是运行前 IAM Gate，不是业务
闭环证明。

下一节点是在修复提交进入 main 后触发新的真实 run。只有它完成浏览器采集、SQS/DLQ、
ECS 清洗、PostgreSQL 查询、Dashboard 图像/录屏与最终自动清理，才能把性能链路标为
已验证。
