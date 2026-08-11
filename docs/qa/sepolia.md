# Sepolia 验证记录

## 当前结论

- 合约测试：27 项通过。
- 前端测试：121 项通过。
- 本地交互：已在 Chrome + MetaMask 测试账户完成连接、活动、便签与赠送验证。
- 合约地址：[`0xeb7216D50a2708a59fef5322e452e34382aFCDaD`](https://sepolia.etherscan.io/address/0xeb7216D50a2708a59fef5322e452e34382aFCDaD#code)。
- 部署交易：[`0x2128ff833511d6f6c03d9c60ab6f161f62909e6f00fedd80710a8826495f674a`](https://sepolia.etherscan.io/tx/0x2128ff833511d6f6c03d9c60ab6f161f62909e6f00fedd80710a8826495f674a)。
- 区块 `11411013`，时间 `2026-08-03T14:42:48.000Z`。
- Etherscan：`Source Code Verified · Exact Match`。
- Sourcify：chain ID `11155111` 完整匹配。

## 公网发布

- 主站：[`babysteps-83x.pages.dev`](https://babysteps-83x.pages.dev/)。
- 托管：Cloudflare Pages，连接 `Tiancheng-Xu/babysteps` 的 `main` 分支。
- 构建命令：`pnpm build`；发布目录：`web/dist`。
- 首次发布：`2026-08-04`，Cloudflare 日志确认识别 pnpm `11.17.0`、Node.js
  `22.16.0`，成功上传 8 个静态文件并部署到全球网络。
- Chrome 可视检查：标题和一级标题均为 `BabySteps · 成长星球`；1920 px 视口下
  页面宽度等于视口宽度，无横向溢出；未发现作业、课程、delivery 或 assignment
  等对外表述；页面自身无控制台错误。
- 备用镜像：[`tiancheng-xu.github.io/babysteps`](https://tiancheng-xu.github.io/babysteps/)。
- 品牌域名 `babysteps.baby2b.online` 暂未绑定。GoDaddy 收据显示已购买一年
  `.ONLINE` 域名注册，但域名尚未出现在产品列表和注册局中；待注册商完成开通后，
  再将权威 DNS 委派给 Cloudflare。

## 便签流程

| 场景 | 交易 | 区块/结果 |
| --- | --- | --- |
| 首次保存 | `0xd2e33abadd8a51a95e4d2631b7e763b3e3f72ff0ebe58d14a9af10e0bcecaf08` | `11411067` |
| 覆盖保存 | `0xfe5ccafa0df32769fc13b690c9869bd69dab392eb81621eabd14882b30eaa347` | `11411295`，`2026-08-03T15:41:36Z` |
| 清空 | `0x1333fd4bf6818149fb5d6673d97ad9dac1ae66e111a9e0c4d2d2da3940d943cb` | 成功 |
| 重复清空 | `0x0b82a5f4eb07dfd702f9a66446bf45d8c9fbc712ebda0b371e993a1a112ae5a9` | `11411316` |
| 恢复内容 | `0x080bd2ffa9438deadde53c52eb1d3b86daed3ebf5198e6bc822a4e6fb62d0120` | `11411322` |

验证了首次保存、覆盖、清空、空值幂等和重新写入；页面刷新后从链上恢复当前状态。

## 成长活动与赠送

| 场景 | 交易 |
| --- | --- |
| 共读 | `0x9b6ac8207945aa4710373640754db41bd707bf39d8f897a6577d680087ab61e2` |
| 喂养 | `0x820841766e0140cdc3d5ac9b6d8613408f67b9f59da3e32fe2cbc6ec35fda535` |
| 散步 | `0x3478ad79c9d03e63d8a4d2cfa99036a3a1bb29cd014f32ea7275b6ca59a07c40` |
| 赠送 2 枚成长星 | `0x1121a7f74db2501175b1c1eeda1bac3d946218f8f5472f6503344bead43a3d2f` |
| 赠送 3 枚成长星 | `0x7245b1faaee699600d534e8fb9f5583d4443a108d18778014529af3c9879fe58` |

最终观察到累计成长值为 `15`、赠送后的可转余额为 `10`，符合双账本设计。接收钱包
获得可转余额，但累计成长值没有被伪造。

## 公开边界

上述记录只包含公开测试链地址与交易证据，不包含私钥、助记词、RPC 凭据、API Key、
真实儿童资料或其他家庭隐私。
