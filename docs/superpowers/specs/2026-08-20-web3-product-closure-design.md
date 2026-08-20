---
title: BabySteps Web3 产品闭环补全
status: Approved
approvedAt: 2026-08-20
---

# BabySteps Web3 产品闭环补全

## 目标

补齐三个现有断点：Provider 必须走 V2 `requestTask`，Owner 能审核；任务视频只对已购钱包开放；家长能提交完课证据，Owner 用自己的钱包调用 `confirmCompletion` 并铸造不可转让的 SBT。

## 选型

- 采用 React + Worker/D1 + Sepolia V2 的现有边界，不新增合约、不迁移链上状态。
- 完课采用 Owner 钱包人工审核。Worker 不保存私钥，不引入常驻 KMS Relayer、Gelato 或 CRE，因此没有新增持续费用。
- D1 只保存任务富内容和完课申请状态；价格、购买、完成和证书归属继续以链上为准。
- 公开视频详情移除 `videoUrl` 与 `completionInstructions`。只有已登录且链上 `purchaseIdForBuyer > 0` 的钱包可读取学习内容。

## 用户流

1. Provider 创建 D1 草稿，调用 V2 `requestTask(payee, activityType, metadataUri, metadataHash)`，交易确认后绑定 `taskId`。
2. Owner 在 Provider 控制台核对待审任务，用钱包调用 `approveTask` 或 `rejectTask`；VRF 在批准后生成价格与开放时长。
3. 家长 `approve → buy` 后，通过受保护 API 获取视频与完成说明。
4. 家长提交不含儿童隐私的完成说明；Worker 校验会话、购买人和 `purchaseId` 后保存证据哈希。
5. Owner 查看待审申请，用钱包调用 `confirmCompletion(purchaseId, evidenceHash, certificateUri)`；交易成功后页面以链上 `getPurchase` 和 SBT 所有权为准。

## 安全与失败边界

- 浏览器不持有 Worker、AWS 或第三方服务凭据。
- 完成说明限制长度并拒绝控制字符；不允许图片、儿童姓名、生日、学校、位置或健康信息。
- Owner API 同时校验签名会话钱包与配置的 `OWNER_WALLET`；链上写入仍由合约角色二次约束。
- 链读取失败返回 `503`，不把未知状态当作已购买或已完成。
- 重复提交同一 `purchaseId + evidenceHash` 幂等；不同证据冲突返回 `409`。
- 若 Owner 尚未获得 `COMPLETION_RELAYER_ROLE`，页面明确提示配置待完成，不能把交易失败写成验收成功。

## 验收

- 公共任务详情不出现私有视频或完成说明。
- 未登录/未购买钱包不能读取内容或提交完课；已购买钱包可以。
- Provider 页面调用 V2 请求接口；Owner 页面能审核待审任务。
- 完课申请、Owner 确认、链上完成和 SBT 查询形成可测试路径。
- Worker/Web 测试、类型检查、构建、公共内容扫描和 Evidence Gate 全部通过；外部交易与生产发布只在真实验收后标为 verified。
