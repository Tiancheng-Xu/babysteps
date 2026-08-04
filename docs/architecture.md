# BabySteps 架构

## 系统边界

BabySteps 是静态前端与 Sepolia 智能合约组成的 DApp。浏览器负责界面、钱包连接和
交易状态展示；MetaMask 管理签名；链上合约负责活动冷却、积分账本、赠送和公开便签。
当前系统没有中心化 API 或数据库。

```text
React UI ──wagmi/viem──> MetaMask ──签名交易──> Sepolia
    │                                           │
    └────────────── eth_call 读取状态 <─────────┘
```

## 双账本模型

- `lifetimeGrowth`：累计成长值，只在钱包完成活动时增加，驱动星宝阶段。
- `transferablePoints`：可转余额，活动领取时增加，赠送时从发送方转到接收方。

因此赠送不会降低发送方已经获得的成长阶段，也不会让接收方冒充完成过活动。

## 活动与冷却

`Meal = 0`、`Walk = 1`、`Read = 2` 分别奖励 3、5、7 枚成长星。合约是规则的唯一
可信来源；前端只把链上状态转成易理解的按钮状态。按钮禁用只是体验层提示，无法
替代合约校验。

## 发布模型

GitHub Actions 在每次 `main` 更新后运行静态检查、测试、类型检查和生产构建，再将
`web/dist` 发布到 GitHub Pages。Vite 使用相对资源路径，因此默认 Pages 地址和
`babysteps.baby2b.online` 都能加载同一份构建产物。
