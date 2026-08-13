# BabySteps 展开版架构图片设计

日期：2026-08-13

## 目标

直接用展开版替换 Evidence 现有两张 SVG，不同时保留概览版。图片需要在介绍项目时一眼展示系统规模，同时严格区分已验证、已实现待验证、计划/延后三种状态，不用虚构节点制造复杂度。

## 方案选择

采用“同一真实系统的两种视角”：

1. **全局架构图**回答系统由什么组成、谁调用谁、数据放在哪里、信任与部署边界在哪里。
2. **端到端业务时序图**回答用户如何从登录、获得 BABY、任务上架、购买到完课证书。

不采用一张超大图同时承担所有内容，也不新增第三套概览图。现有 Evidence 页面、原图链接和文件路径保持稳定，只替换图片内容与相邻走读。

## 全局架构图

画布目标为 2400 × 1500 左右，采用 StarBuddy 米白、金色、鼠尾草绿、海军蓝主题。

### 六列责任边界

1. 用户与角色：家长、Provider、Owner、外部钱包。
2. React Web：Privy/Reown、任务市场、BabyCoin/兑换、个人中心、Evidence。
3. Cloudflare：Pages、Worker API、D1、challenge-sign-verify、HTTP/TLS/健康检查。
4. Ethereum Sepolia：BabyCoin、TaskMarketplaceV2、GrowthCertificateSBT。
5. Web3 外部依赖：Chainlink VRF、Uniswap v3、The Graph、Public/Infura/Alchemy RPC。
6. 交付与延后 AWS：本地 Gate、GitHub Actions、Cloudflare Git Integration、AWS 可暂停边界、生产 Relayer。

### 四条横向数据带

1. 用户运行与认证。
2. 任务内容和链上/链下事实所有权。
3. 代币、购买、随机与证书闭环。
4. CI/CD、权限、安全、可观测、失败回滚和清理。

箭头必须标出 HTTPS、challenge/sign/verify、签名交易、JSON-RPC、GraphQL、事件读回、OIDC 和部署触发；线型图例区分请求流、数据流、链上交易、异步事件和计划路径。

## 端到端业务时序图

画布目标为 2400 × 1800 左右，按五段横向泳道展示：

1. **登录会话**：Privy/Reown → challenge → 钱包签名 → Worker verify → D1 session。
2. **Uniswap 获得 BABY**：官方 Sepolia USDC/WETH → quote → approve（适用时）→ swap → RPC 余额刷新。
3. **Provider 上架与 Owner 审核**：D1 草稿/视频/评论规则 → canonical hash → requestTask → approve/reject → VRF 回调随机价格和时长。
4. **家长购买结算**：读取余额和 allowance → 精确 approve → buy → transferFrom → receipt → D1 购买绑定。
5. **完课与证书**：完成证据 hash → Relayer → Marketplace 幂等确认 → ERC-5192 SBT → The Graph/RPC 独立读回。

每段同时画出主要失败分支：签名过期、RPC 不一致、滑点/余额不足、hash 冲突、VRF pending、allowance/receipt 失败、Relayer 重试、Graph 延迟。失败不得伪造链上余额、重复扣款或重复铸证。

## 页面与响应式

- Evidence 页面仍只展示两张图片卡片，标题保持“全局架构图”和“核心业务时序图”。
- 1440 px 直接完整显示；390 px 卡片不撑宽根页面，图片框内部横向查看并提供“查看原图”链接。
- 每张图更新“看哪里 / 证明什么”，先指导非技术读者按层或按阶段阅读，再说明工程证明。
- SVG 保留 `<title>`、`<desc>` 和准确的中文替代文本。

## Gate 与测试

先增加失败测试，再生成展开版图片：

- 两张 SVG 必须存在、非空且拥有展开版画布尺寸。
- 全局图必须包含六列责任边界、四条数据带、协议/线型图例和三种真实状态。
- 时序图必须包含五段业务闭环和主要失败分支。
- Evidence 页面必须继续发布两图、原图链接以及“看哪里 / 证明什么”。
- 运行前端测试、类型检查、生产构建、公开产物扫描、Evidence Gate、仓库策略和 390/1440 响应式实测。

## 明确不引入

- 不引入同学项目的固定 Sale 合约、Foundry、EC2 单机 PostgreSQL/Redis 或图片素材。
- 不把 Chainlink VRF 写成价格预言机。
- 不把 AWS KMS Relayer、IPFS pin 或其他未验证能力标为完成。
- 不改变合约、Worker、数据库或生产发布配置；本次仅改架构图片、Evidence 走读、Gate、测试和截图。

## 完成标准

两张展开版 SVG 替换现有图片，Evidence 页面与移动/桌面截图同步更新；本地与 GitHub 使用同一门禁契约；全部验证通过后本地提交，但没有用户新的明确授权时不推送、不部署生产环境。
