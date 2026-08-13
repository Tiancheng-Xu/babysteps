# BabySteps 端到端数据流架构图设计

## 目标

在不引入虚构服务的前提下，把现有全局架构图和业务时序图升级为可沿线讲解的工程全景：每条核心业务都能从用户入口追踪到链下存储、链上交易、外部依赖、读回验证和失败处理。

## 选定方案

采用 A「展开工程版」。保留六列责任边界和已实现/待验证/计划状态，在其上增加五条端到端编号流：

1. 登录与会话：钱包选择 → challenge → sign → verify → HttpOnly session。
2. 兑换获得 BABY：USDC/WETH → quote → approve → Uniswap Router/Pool → BABY → receipt 与余额刷新。
3. 上架与随机激活：Provider 草稿 → D1 metadata/hash → requestTask → Owner 审核 → VRF → Active。
4. 购买与结算：读取价格 → 精确 approve → buy → transferFrom → Provider → PurchaseRecorded → D1 绑定。
5. 完课与证书：evidenceHash → 受限 Relayer → confirmCompletion → locked SBT → Graph/RPC 独立读回。

CI/CD 独立作为第六条交付流，展示 GitHub Actions、Cloudflare PR Preview、Gate、生产别名、失败保持上一有效部署和 preview_id 精确清理。

## 视觉约束

- 编号和颜色在全局图与时序图中一致。
- 主线使用连续线；事件/回调用虚线；计划路径使用紫色点划线。
- 每条流都写出载荷或协议，不使用无含义箭头。
- 失败分支必须连接到实际失败点，明确停止、重试或降级结果。
- 移动端允许架构图横向滚动；同时提供原图链接。
- 不把 AWS KMS Relayer、AWS Runtime 或 Privy 完整闭环标成已验证。

## 验收

- Gate 能验证五条业务编号流、兑换与购买的关键方法、失败分支、CI/CD/回滚标记。
- 两张 SVG 可独立打开，文字不裁切，箭头方向与真实调用一致。
- Evidence 页面相邻文字说明“从哪里开始看、各颜色代表什么、失败时如何处理”。
- 本地测试、构建、公开内容扫描和响应式验收通过后才给用户查看。
