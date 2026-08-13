# BabyCoin 数字展示与响应式验收

日期：2026-08-13

## 目标与实现映射

| 需求 | 实现功能 | 代码位置 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- |
| 链上余额不直接展示 18 位小数 | 使用 `bigint` 安全格式化，最多显示 4 位小数、四舍五入并移除末尾 0；精确链上值仍保留在辅助文本和悬浮说明中 | `web/src/features/babycoin/formatBabyCoinAmount.ts` | `formatBabyCoinAmount.test.ts` 覆盖整数、长小数、进位和极小非零值 | 已实现并验证 |
| 区分可用余额与累计成长 | 两张卡分别说明“消费后会减少”和“只增不减、决定成长阶段” | `web/src/features/babycoin/BabyCoinGrowthPanel.tsx` | `App.test.tsx` 验证标题、说明和精确值辅助文本 | 已实现并验证 |
| 市场与兑换页采用同一数字规则 | 任务卡余额和 Uniswap 预估到账均复用同一格式化器，交易计算继续使用原始 `bigint` | `web/src/features/marketplace/MarketplaceTaskCard.tsx`、`web/src/features/exchange/useUniswapSwap.ts`、`web/src/pages/ExchangePage.tsx` | Marketplace 与 App 回归测试通过 | 已实现并验证 |
| 手机与桌面端可读 | 375/390/430 px 单列，1440 px 双列；数字与单位分离、使用等宽数字，允许安全换行 | `web/src/styles.css` | 四档浏览器实测均无横向溢出 | 已实现并验证 |

## 看哪里，证明什么

### 390 px 手机布局

![390 px 下的 BabyCoin 余额卡片](../screenshots/2026-08-13-web-ui/babycoin-balance-mobile-390.jpg)

- 看哪里：两张卡片纵向排列；数值和 `BABY` 单位有清晰层级；每张卡都带用途说明。
- 证明什么：窄屏下不会把余额挤成难读的长串，也不会产生横向滚动。

### 1440 px 桌面布局

![1440 px 下的 BabyCoin 成长面板](../screenshots/2026-08-13-web-ui/babycoin-balance-desktop-1440.jpg)

- 看哪里：成长形象与链上指标左右分区，两张余额卡并排；“可用”和“累计”说明位于同一视觉区。
- 证明什么：桌面端的信息层级和对比关系清楚，同时保留活动入口和成长阶段上下文。

### 资产清单

| 文件 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| `babycoin-balance-mobile-390.jpg` | 310 × 380 | 11,662 | `8f71105dcd59be45ae6859f0133ba3a41305a1b6439d58e5ba3dee22187a6545` |
| `babycoin-balance-desktop-1440.jpg` | 1440 × 900 | 100,395 | `dfa77bff5aa8bfff131857e07dd6d74fc51fa5f353d281f3f4775e686a538dcf` |

## 验证结果

- 前端测试：28 个测试文件、164 项测试全部通过。
- 前端构建：TypeScript 与 Vite 生产构建通过。
- 公开产物检查：通过；凭据格式和敏感变量赋值仍覆盖全部公开 JS。
- 响应式测量：375、390、430、1440 px 的 `scrollWidth` 均等于 `clientWidth`，没有根级横向溢出。
- 已知非阻塞项：Privy 依赖仍产生大于 500 kB 的分包警告，后续可通过按路由加载继续优化首屏性能。
