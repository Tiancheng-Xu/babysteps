# BabySteps stopped 安全 Bootstrap 合同

状态：`local-verified / cloud-not-dispatched`

本合同解决一个冷启动边界：中央性能控制 D1 尚无 BabySteps 状态行，但 AWS Runtime 已关闭且项目资源已清理时，不能把未知状态直接猜成 `stopped`，也不能为了建行先启动一次收费 Runtime。

## 固定信封

- `source`：`babysteps-performance-control-bootstrap-v1`
- `operation`：`bootstrap-stopped-state`
- `generation`：只允许 `1`
- `status`：只允许 `stopped`
- 必填正文：`deliveryId`、`operationId`、`workflowRunId`、`occurredAt`、`cleanupVerified=true`、`zeroResidualVerified=true`、`bootstrapOnly=true`、`proof`
- 传输认证：`x-performance-timestamp`、`x-performance-delivery-id`、`x-performance-signature-256`；签名仍为 `HMAC-SHA256(timestamp + "." + exactRawBody)`，同一次 delivery 的重试不得重签或换正文。

## 双来源零残留证明

`cleanupVerified=true` 与 `zeroResidualVerified=true` 不能由调用方自由填写，必须同时满足：

1. 已验证 GitHub Actions Artifact：Run `33279132965`、Artifact `9722636468` 对应的项目 Evidence，证明 Schema 不存在、Stack 不存在、12 类项目资源为 0、共享 Foundation 受保护；正文只携带 Artifact 标识与 Evidence SHA-256，不携带凭据。
2. Bootstrap workflow 当次 OIDC 只读盘点：固定 Stack 不存在、当前可运行项目资源为 0、共享 Foundation 受保护。

实现位置：`scripts/performance-control-bootstrap.mjs`；生产者位置：`.github/workflows/aws-performance-control.yml` 的 `Publish initial verified stopped bootstrap callback`。

## D1 首次建行条件

中央消费者只有在以下条件全部为真时才能执行 `insert-initial-stopped-row`：

1. BabySteps control row 当前不存在；
2. HMAC 校验成功；
3. timestamp 在消费者允许时间窗内；
4. Header delivery ID 与 exact raw body 的 `deliveryId` 一致，且未重放；
5. `source`、`operation`、`generation=1`、`status=stopped` 与 `bootstrapOnly=true` 精确匹配；
6. 上述历史 Artifact 和当次 AWS 零残留读回均通过。

只要任一条件失败，结果固定为 `reject`，不得建行、不得更新已有行、不得降级成普通 `stop`，也不得启动 AWS Runtime 进行“自证”。已有 control row 时必须走正常 generation/operation 状态机。

## 本地验证

- `node --test scripts/performance-control-bootstrap.test.mjs scripts/performance-lifecycle-contract.test.mjs`：21/21 lifecycle + 3/3 bootstrap，共 24/24 通过。
- `node --test --test-name-pattern='implemented feature (preflight|live preflight)' scripts/performance-pipeline-contract.test.mjs`：2/2 通过。
- `pnpm validate:performance-pipeline`：通过。
- `pnpm validate:performance-budget`：通过。

当前没有 dispatch 该 bootstrap workflow，没有发出生产回调，没有创建 D1 行，也没有启动 AWS Runtime；这些仍属于云端待验证。
