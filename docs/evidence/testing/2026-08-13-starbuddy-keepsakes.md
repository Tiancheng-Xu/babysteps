# StarBuddy 纪念卡本地与 Sepolia 交付证据

日期：2026-08-13

## 结论

纪念卡的合约、前端、响应式页面和恢复边界已在本地验证；Sepolia 三合约、VRF consumer 与真实抽卡已验证。融合合约和本地测试已完成，但真实融合交易仍等待自然积累三张同系列、同稀有度卡。

## 要求到证据映射

| 要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 用可转送成长星兑换随机纪念卡 | 固定扣 12 星；阶段和稀有度分别由 VRF 随机；不影响 lifetimeEarned 和成长阶段 | `contracts/contracts/OnchainNotebook.sol`、`contracts/contracts/StarBuddyKeepsakes.sol`、`contracts/scripts/runSepoliaStarBuddyClosedLoop.ts` | 合约全套 108/108；Sepolia 真实抽卡铸出 SBT #1（星耀 · 闪耀星宝） | `complete` |
| 三张相同卡融合升级 | 相同 series/rarity；Common/Rare/Star 成功率 100/70/40%；Collector 不再融合 | `contracts/contracts/StarBuddyKeepsakes.sol` | 融合成功/失败、输入校验测试通过 | `partial` |
| 失败和超时不吞资产 | 失败随机烧 1 解锁 2；24 小时未回调可退款或解锁；迟到回调忽略 | `contracts/contracts/StarBuddyKeepsakes.sol` | 恢复与迟到回调测试通过 | `partial` |
| 纪念凭证不可转让 | ERC-5192 锁定；只有协调合约可 mint/burn；钱包可枚举 | `contracts/contracts/StarBuddyKeepsakeSBT.sol` | SBT 权限、锁定和枚举测试通过；Sepolia SBT #1 owner、locked 与 tokenURI 已读回 | `complete` |
| 2.5D 纪念馆与融合成功反馈 | 四阶段卡面、概率说明、合约未配置提示、融合动态反馈、reduced-motion 降级 | `web/src/features/keepsakes/KeepsakeGalleryPage.tsx`、`web/src/styles.css` | Web 全套 174/174；1440/390/375/430 实测，无根级横向溢出 | `partial` |

`partial` 只用于真实融合和发布后的页面验收：当前没有通过管理员捷径制造三张匹配卡，避免把演示便利误当真实用户路径。

## Sepolia 真实闭环

- OnchainNotebook：`0xDA7Ab295E2e2AEc535A04F44A39AdE073dd9CF91`
- StarBuddyKeepsakeSBT：`0xED658a6F2e562ce24B6121a5a3e9304d0192E627`
- StarBuddyKeepsakes：`0xb343A0a62595d83d3Da55752DDB120a0744BfF68`
- VRF consumer：交易 `0x24fb…cdd`
- 成长星准备：三笔活动交易 `0xcef5…0d2d`、`0xf716…2681`、`0xf8db…e33f`
- 固定 12 星抽卡：交易 `0x2b8c…a64`；requestId `21556819699894985189007538881789214622703899919613339686232435101559844498256`
- 结果：SBT #1，series 3 / rarity 2（星耀 · 闪耀星宝），`locked=true`，余额从 15 降至 3
- 脱敏机器证据：`docs/evidence/deployment/2026-08-14-starbuddy-sepolia-closed-loop.json`

## 视觉证据

- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-desktop.png`：看固定费用、概率、阶段卡面、融合区与未配置状态；证明桌面布局真实可运行。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-mobile-390.png`：看 390px 单列和触控操作；证明移动端无根级横向溢出。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/evidence-keepsakes-desktop-1440.jpg`：看公开 Evidence 的七条跨层流、六段时序和相邻走读；证明桌面端证据页面与真实实现一致。SHA-256：`ca90dbefa663d4615ddbdc68fa5330083b1ab130a4fba8c07f524bed2c2a2eb5`，830001 bytes。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/evidence-keepsakes-mobile-390.jpg`：看架构图横向缩放、文字卡片单列和完整状态说明；证明 390px Evidence 无根级横向溢出。SHA-256：`ad6007b8699fd8fc3c9736aba6cb0c43925c0e653fab4265cde88c8e8752f33e`，413812 bytes。

Sepolia 部署后的发布候选截图位于 `docs/evidence/screenshots/2026-08-14-starbuddy-sepolia/`：

- `keepsake-gallery-sepolia-desktop-1440.png` 与 `keepsake-gallery-sepolia-mobile-390.png`：看页面已移除“等待部署”，在未连接钱包时诚实显示未知余额和 0 张卡；证明正式地址已进入构建且桌面/手机均无根级横向溢出。
- `evidence-starbuddy-sepolia-desktop-1440.png` 与 `evidence-starbuddy-sepolia-mobile-390.png`：看“StarBuddy Sepolia 已验证”、真实 SBT #1 和自然库存融合边界；证明公开 Evidence 与链上证据表述一致。
- `manifest.json` 记录四张图的字节数、SHA-256 和真值边界；截图只证明发布候选 UI，链上抽卡仍以脱敏 JSON 和交易回执为准。

## 剩余验收

1. 发布包含三份正式地址和 16 份 metadata 的 Web，并确认 metadata 返回 JSON 而非 SPA HTML。
2. 后续由真实抽卡自然积累三张匹配卡，再补一次融合成功/失败或超时恢复交易；此前只保留本地完整测试证明。
