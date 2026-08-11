# BabySteps / StarBuddy 架构

完整、可执行的架构真相源见 [`docs/architecture/starbuddy-web3-architecture.mmd`](architecture/starbuddy-web3-architecture.mmd)。当前 StarBuddy 主题业务图见 [`docs/architecture/starbuddy-web3-architecture-v2.png`](architecture/starbuddy-web3-architecture-v2.png)；上一版 PNG 保留为历史证据。

## 当前边界

- 浏览器：React、外部钱包；Privy 邮箱入口仍待接入。
- Cloudflare：Pages 已有历史上线证据；Worker/D1 已完成本地实现，远程待部署。
- Sepolia：V1 BabyCoin、Marketplace 和 VRF 闭环已有交易证据；V2 审核、幂等完成和 ERC-5192 已本地验证，待部署。
- AWS：隔离 VPC、两条私有子网、私有 RDS、Readiness/自动停库 Lambda、EventBridge、GitHub OIDC、私有 S3 与 CodeBuild 已真实部署；Runtime Stack 为 `CREATE_COMPLETE`，RDS 为 `stopped`。API Gateway、NAT/EIP、KMS、Secrets 和生产 Relayer 明确延后。
- 读取：公共 RPC 有历史证据；ethers.js 三源对照与 The Graph 仍待实现。

## 核心数据流

```mermaid
flowchart LR
    user["家长 / Provider / Owner"] --> web["React + wallet"]
    web --> worker["Cloudflare Worker"]
    worker --> d1[("D1 富内容、评论、会话、审计")]
    web --> market["Marketplace V2 / Sepolia"]
    ci["OIDC → S3 → CodeBuild"] --> cfn["CloudFormation"]
    cfn --> probe["Readiness Lambda<br/>已验证 200"]
    cfn --> stop["EventBridge → StopDatabase Lambda"]
    stop --> rds[("私有 RDS<br/>已验证 stopped")]
    worker -.->|"生产阶段延后"| api["API Gateway / Relayer / KMS / NAT<br/>计划，未部署"]
    api -.-> market
    market --> vrf["Chainlink VRF"]
    market --> coin["BabyCoin"]
    market --> sbt["ERC-5192 证书"]
```

链上保存角色、任务状态、随机价格/时间、支付、完成哈希与证书；D1 保存视频 URL、评论、用户名和审计。当前 RDS 只完成私网、加密和停库基础设施验收，还没有迁移业务表或接收产品数据；未来 Relayer 才会保存完成请求的幂等状态和 webhook nonce hash。三个存储都不得保存儿童敏感信息。

## AWS 启动与清理门禁

AWS 工作流仅允许 `workflow_dispatch`。只有 main、`start_services=true`、GitHub `aws-readiness` Environment 人工审批和 OIDC 短期身份同时满足，才会上传 S3 源码包并启动单并发 CodeBuild。buildspec 在测试、类型和 SAM lint 后再次检查 `ALLOW_AWS_PAUSABLE_DEPLOYMENT=true`，然后只允许部署 `aws/pausable-template.yaml`。

本次已用不可变提交 ZIP 直接启动同一 CodeBuild 项目并完成云端闭环；GitHub main 的 OIDC workflow 端到端触发仍待分支合并/推送后验证。RDS 已自动停止，但仍收存储费；永久删除 CloudFormation Stack 前仍需按精确 Region、Stack 和资源列表再次确认。真实证据见 [`docs/evidence/deployment/2026-08-11-aws-pausable.md`](evidence/deployment/2026-08-11-aws-pausable.md)。
