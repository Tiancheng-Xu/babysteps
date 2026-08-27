# Performance control read-only preflight

## 结论

2026-08-27 的首次生产只读预检证明 GitHub OIDC 可以取得
`babysteps-performance-deploy` 的短期 AWS 身份，且 `preflight` 不进入部署、删除、
SSM 标记或控制面回调。零残留结论仍未成立，因为角色缺少
`lambda:GetFunction`，检查在读取固定 Lambda 名称时失败关闭。

## 已验证

- GitHub Actions run：`33037553599`
- `Validate untrusted control request`：通过
- `Configure short-lived AWS credentials`：通过
- `Resolve fixed action and expiry`：通过，动作是 `preflight`
- 部署、镜像推送、ECS Task、Schema、Stack 删除、SSM 与全部回调步骤：跳过
- 脱敏 Artifact：`oidcIdentityVerified=true`、`mode=read-only-preflight`

## 未验证

- 固定 Stack、Lambda、ECR、SQS、Logs、Secrets、API Gateway 和 ECS Task
  Definition 是否全部无残留
- 原因：IAM 在 `lambda:GetFunction` 返回 `AccessDenied`
- 该失败不能解释为资源存在，也不能解释为资源不存在

## 最小权限修复

`aws/iam/performance-control-readback-policy.json` 是独立附加策略，只包含零残留
Gate 所需读取动作，资源限制为 BabySteps 固定名称；必须使用 `Resource: "*"` 的
列表动作额外限制在 `us-east-1`。它不包含创建、更新、运行、停止、删除或
`iam:PassRole`。

管理员应用命令：

```bash
aws iam put-role-policy \
  --role-name babysteps-performance-deploy \
  --policy-name BabyStepsPerformanceReadback \
  --policy-document file://aws/iam/performance-control-readback-policy.json
```

应用后必须重新触发 `action=preflight`。只有 OIDC、完整零残留检查和脱敏 Artifact
全部通过，才能把第一阶段标记为完成。
