# StarBuddy 纪念卡本地交付证据

日期：2026-08-13

## 结论

纪念卡的合约、前端、响应式页面和恢复边界已在本地验证；没有执行 Sepolia 部署，因此新合约地址、VRF consumer 和真实抽卡/融合交易均标记为待验证。

## 要求到证据映射

| 要求 | 实现功能 | 代码位置 | 验证证据 | 当前状态 |
| --- | --- | --- | --- | --- |
| 用可转送成长星兑换随机纪念卡 | 固定扣 12 星；阶段和稀有度分别由 VRF 随机；不影响 lifetimeEarned 和成长阶段 | `contracts/contracts/OnchainNotebook.sol`、`contracts/contracts/StarBuddyKeepsakes.sol` | `OnchainNotebook.ts`、`StarBuddyKeepsakes.ts`；合约全套 108/108 | `partial` |
| 三张相同卡融合升级 | 相同 series/rarity；Common/Rare/Star 成功率 100/70/40%；Collector 不再融合 | `contracts/contracts/StarBuddyKeepsakes.sol` | 融合成功/失败、输入校验测试通过 | `partial` |
| 失败和超时不吞资产 | 失败随机烧 1 解锁 2；24 小时未回调可退款或解锁；迟到回调忽略 | `contracts/contracts/StarBuddyKeepsakes.sol` | 恢复与迟到回调测试通过 | `partial` |
| 纪念凭证不可转让 | ERC-5192 锁定；只有协调合约可 mint/burn；钱包可枚举 | `contracts/contracts/StarBuddyKeepsakeSBT.sol` | SBT 权限、锁定和枚举测试通过 | `partial` |
| 2.5D 纪念馆与融合成功反馈 | 四阶段卡面、概率说明、合约未配置提示、融合动态反馈、reduced-motion 降级 | `web/src/features/keepsakes/KeepsakeGalleryPage.tsx`、`web/src/styles.css` | Web 全套 174/174；1440/390/375/430 实测，无根级横向溢出 | `partial` |

`partial` 的唯一原因是新功能尚未部署到 Sepolia；本地实现不是公开链上完成证明。

## 视觉证据

- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-desktop.png`：看固定费用、概率、阶段卡面、融合区与未配置状态；证明桌面布局真实可运行。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/keepsake-gallery-mobile-390.png`：看 390px 单列和触控操作；证明移动端无根级横向溢出。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/evidence-keepsakes-desktop-1440.jpg`：看公开 Evidence 的七条跨层流、六段时序和相邻走读；证明桌面端证据页面与真实实现一致。SHA-256：`ca90dbefa663d4615ddbdc68fa5330083b1ab130a4fba8c07f524bed2c2a2eb5`，830001 bytes。
- `docs/evidence/screenshots/2026-08-13-starbuddy-keepsakes/evidence-keepsakes-mobile-390.jpg`：看架构图横向缩放、文字卡片单列和完整状态说明；证明 390px Evidence 无根级横向溢出。SHA-256：`ad6007b8699fd8fc3c9736aba6cb0c43925c0e653fab4265cde88c8e8752f33e`，413812 bytes。

## 外部待验证

1. 部署升级后的 OnchainNotebook、StarBuddyKeepsakes、StarBuddyKeepsakeSBT。
2. 将协调合约加入 Chainlink VRF subscription consumer。
3. 写入正式合约地址，执行一次抽卡、一次融合成功/失败或超时恢复，并独立读回余额、owner、locked、URI 和交易回执。
