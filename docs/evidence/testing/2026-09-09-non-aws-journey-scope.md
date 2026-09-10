# BabySteps 非 AWS Journey 独立执行合同

## 当前结论

当前状态是 `local-verified`。执行器已经能把非 AWS 产品旅程与临时 AWS 性能管线拆开验证，但尚未执行本轮可见钱包交易或生成新的全功能录屏，因此不能标记为 `sepolia-verified`。

## 精确边界

- `--scope non-aws` 选择 30 个 Journey。
- 唯一排除项是 `PERF-01`，原因固定为 `AWS_SCOPE_EXCLUDED`。
- Sepolia、产品 UI、Worker/D1 与 Privy 仍按原有可见界面和人工签名 Gate 执行。
- `/api/performance/*` 在本模式由受控浏览器明确返回 503，不连接或误触 AWS 性能后端。
- 每个结果写入 `telemetry.status=not-collected` 与 `telemetry.reason=AWS_SCOPE_EXCLUDED`，不会把缺少 AWS telemetry 冒充已接收。
- 预检只接受 `scope=sepolia` 的新鲜只读快照；完整模式仍要求 `scope=full`，不会因新增非 AWS 模式而放宽原 AWS Gate。

## 本地验证

- 非 AWS dry-run：30 项。
- 排除清单：`PERF-01` 1 项。
- 预检作用域错配：fail-closed。
- 完整 31 项录屏合同：保持原行为，仍要求 AWS telemetry。
- 非 AWS 录屏合同：要求 30 个精确章节、唯一排除项、媒体哈希、人工联系表审阅、375/390/430/1440、pageerror 0 与根级横向溢出 0。

## 尚未完成

- 用户可见钱包下的 30 项真实 Journey。
- 对应 Sepolia 交易与 Worker/D1 回读。
- 新录屏、联系表人工审阅和公开 Evidence 升级。
- AWS Live、性能 telemetry 与 `PERF-01` 明确保留为暂停状态。
