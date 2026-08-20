# Web3 产品闭环补齐证据（2026-08-20）

## 结论

本次补齐了三个此前只在合约或脚本层存在、但 Web 产品入口不完整的环节：

1. Provider 使用 V2 `requestTask` 提交任务，Owner 授权钱包审核或驳回；
2. 视频和完成说明不再由公共任务详情直接返回，只有签名会话与链上购买事实同时成立时才解锁；
3. 家长提交任务完成说明后，Worker 按 `purchaseId` 幂等保存 evidence hash，Owner 授权钱包再调用 `confirmCompletion` 铸造锁定 SBT。

本地实现、单元测试和类型检查已通过。Web UI、D1 migrations `0002`/`0003` 与 Worker #4 已发布；生产健康、CORS 与鉴权边界已经 HTTP 验收。生产已购钱包尚未提交新的完成申请，也未发送新的 Sepolia `confirmCompletion` 交易，因此不得把“接口上线”解读为“新业务交易已经完成”。

## 要求 → 实现 → 代码 → 证据 → 状态

| 要求 | 实现 | 代码位置 | 本地证据 | 状态 |
| --- | --- | --- | --- | --- |
| Provider 提交、Owner 审核 | Provider 调 V2 `requestTask`；Owner 校验 `DEFAULT_ADMIN_ROLE` 后调用 `approveTask` 或 `rejectTask`，拒绝原因只保存规范化哈希 | `web/src/features/provider/useProviderTaskCreation.ts`、`web/src/features/provider/useOwnerTaskReview.ts`、`web/src/pages/ProviderConsolePage.tsx` | ABI、Provider Hook、Owner Hook 与页面测试通过；Provider 页面生产 HTTP 200 | UI 已发布；生产钱包新交易待验证 |
| 购买后才能看视频 | 公共 `GET /api/tasks/:taskKey` 不返回视频；签名 `GET /api/tasks/:taskKey/content` 再核验 `purchaseIdForBuyer` | `worker/src/routes/tasks.ts`、`web/src/features/marketplace/TaskLearningPanel.tsx` | 覆盖未登录、未购买、RPC 失败、已购解锁；RPC 失败按 503 关闭；Worker #4 已发布 | 代码与云端路由已验证；生产已购回读待验证 |
| 家长提交任务完成证据 | 登录钱包提交短文本与 HTTPS/IPFS 证书 URI；Worker 重新校验已购事实并计算 canonical keccak hash | `worker/src/routes/completions.ts`、`worker/src/repositories/completionRepository.ts`、`worker/migrations/0003_completion_submissions.sql` | 覆盖未购拒绝、明显 PII 拒绝、相同请求幂等、冲突请求 409；D1 `0003` 已应用，未登录 `GET /api/completions` 返回 401 | D1/Worker 已发布；生产已购提交待验证 |
| Owner 确认并铸 SBT | Owner 面板读取待确认项，钱包必须具备 `COMPLETION_RELAYER_ROLE`，把相同 `purchaseId/evidenceHash/certificateUri` 写入 `confirmCompletion` | `web/src/features/provider/OwnerCompletionReviewPanel.tsx`、`web/src/features/provider/useOwnerCompletionConfirmation.ts` | Hook 与面板测试通过；缺少角色时明确阻断 | 本地已验证；生产角色与新交易待验证 |
| 已购内容不因任务到期丢失 | 已购状态优先于任务暂停/过期状态，防止购买后无法继续学习 | `web/src/features/marketplace/useTaskPurchase.ts` | 先写失败用例，再修正状态优先级 | 本地已验证 |

## 测试驱动记录

| 先出现的失败 | 修复后的行为 |
| --- | --- |
| 公共任务接口仍泄露视频，内容接口为 404 | 公共字段已脱敏；内容接口要求会话与链上购买 |
| V2 ABI 缺少 request/approve/reject | ABI 与 Provider/Owner Hook 对齐 V2 合约 |
| 完成申请路由与前端入口均不存在 | 新增 migration、Repository、Worker 路由、家长面板和 Owner 面板 |
| 任务到期后已购用户被标为 unavailable | 已购事实优先，继续显示内容与完成入口 |

本轮阶段性验证：

- Worker：8 个测试文件、62 个测试通过；`typecheck`、`check` 通过。
- Web：47 个测试文件、226 个测试通过；`typecheck` 通过；`check` 无错误，仅保留原有样式告警。
- 架构图：全局图与关键业务时序图已改为“Owner 授权钱包（本期）/KMS Relayer（可替换）”，并标出云端待发布边界。
- 响应式：Provider 在 375/390/430、Evidence 在 1440 像素均为 0 横向溢出、0 page error；验收同时发现并修复了超宽 SVG/截图撑开隐式 Grid 列的问题。
- 可视证据：`docs/evidence/screenshots/2026-08-20-web3-product-closure/` 保存桌面 Evidence 与 390 像素 Provider 控制台截图；Gate 固定校验字节数和 SHA-256，截图只证明本地 UI，不冒充钱包角色、云端发布或链上交易。

最终提交前还会重跑仓库级测试、类型检查、生产构建、公开内容扫描、链接与 SVG 解析 Gate；最终数字以提交对应的 CI/本地运行记录为准。

## 生产发布证据

- PR [`#25`](https://github.com/Tiancheng-Xu/babysteps/pull/25) 已合并，main commit `de107c217cc65ed8d4514c894b050f6dd46afdeb`；GitHub Actions Run [`32341430173`](https://github.com/Tiancheng-Xu/babysteps/actions/runs/32341430173) 全部成功。
- Cloudflare Pages production deployment `208b0c8f-aed1-459f-ac20-50ea5681d0e7` 使用 `pnpm build` 与 `web/dist`，`/provider`、`/evidence` 均返回 200。
- D1 迁移账本按顺序包含 `0001_initial.sql`、`0002_performance_rate_limit.sql`、`0003_completion_submissions.sql`；`performance_rate_limits`、`completion_submissions` 与索引 `idx_completion_submissions_created` 均存在。
- Worker version #4 `1fa5eb56-57a6-4228-80f2-44403cecfd47` 已获 100% 流量；`/api/health` 返回 200，`/api/completions` 在无会话时返回预期 401，`OPTIONS /api/profile` 返回 204 并允许正式域名与 PUT。
- 机器可读的脱敏记录见 `docs/evidence/deployment/2026-08-20-cloudflare-web3-product-closure.json`。

## 链上与云端边界

- 已有真实链上证据：V2 Provider/Owner/VRF/购买/完成交易与锁定 SBT #1，见 `docs/evidence/deployment/2026-08-11-sepolia-v2-business.json`。
- 本次没有发送新链上交易，也没有授予新的生产角色。
- 当前前端采用用户控制的 Owner 授权钱包，不保存私钥，不新增持续计费服务。
- AWS KMS Relayer 仍是可替换增强，不是本次完成条件，也未启用。
- 新增 Worker API 与 D1 表已经生产发布；会话鉴权边界已验证，已购门禁、完成提交和真实钱包确认仍需业务身份验收。

## 安全与失败路径

- 浏览器无 Worker 管理凭据、AWS 凭据或私钥。
- 公共接口不暴露视频与完成说明。
- Worker 不能读取链上购买事实时返回 503，而不是放行内容或完成申请。
- 完成申请拒绝控制字符和明显 PII 标签；公开 Evidence 不保存家长提交正文。
- `purchase_id` 唯一；完全相同的重试返回同一记录，不同证据产生 409 冲突。
- Owner 页面缺少 `COMPLETION_RELAYER_ROLE` 时停止发送交易并给出可解释状态。
