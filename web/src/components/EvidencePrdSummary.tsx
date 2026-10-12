export function EvidencePrdSummary() {
	return (
		<section
			id="prd-design"
			className="evidence-recorded-proof"
			aria-labelledby="prd-evidence-summary-title"
		>
			<header className="evidence-recorded-proof__header">
				<div>
					<p className="section-kicker">PRODUCT · MECHANISM · EVIDENCE</p>
					<h2 id="prd-evidence-summary-title">产品定位与证据边界</h2>
				</div>
				<span className="evidence-diagram-card__status">
					PRD 摘要 · 2026-10-12
				</span>
			</header>
			<p>
				BabySteps 面向成年照护者，以无需登录或钱包的三分钟亲子任务降低体验门槛，
				再按需进入成长记录、任务购买与 Sepolia 链上证书。这是全栈 / Edge Web3
				概念验证；中国、日本和城市选择是演示配置，没有真实社交运营、商业合作或育儿效果数据。
			</p>
			<h3>当前机制</h3>
			<p>
				访客任务只保存在当前浏览器。进阶任务由 Provider 请求、Owner 审核、VRF
				回调后启用；购买按精确额度 approve → 成功回执 → buy → 成功回执执行，
				Worker
				再核对会话钱包与链上购买事实。完成确认需要独立角色，每笔购买对应一张锁定
				SBT；钱包连接、业务授权、交易成功分别核验，广播哈希不能当作成功。
			</p>
			<h3>历史验证与本次同步</h3>
			<p>
				下列 Sepolia、D1、渲染、性能和录屏记录保留各自日期、版本与分母。PR #83
				的 2026-10-06 发布回执证明当时
				CI、Cloudflare、域名、深链及附件验收通过； 2026-10-12
				的本次改动只同步公开文案，没有连接钱包、签名、运行 AWS
				或重新完成业务交易。受控性能样本不能当作当前生产用户数据。
			</p>
			<h3>设计与待补验范围</h3>
			<p>
				跨设备家庭档案、中日社交后台和门店试点仍是后续方案；真实融合、长期完成确认服务、
				新版端到端交易与完整保留 /
				删除流程需单独验收。链上证书证明受限确认流程，
				不能证明现实陪伴真实性，也不代表主网资产、收益或医疗育儿判断。
			</p>
			<p style={{ overflowWrap: "anywhere" }}>
				来源：2026-10-11 现状 PRD；文档 SHA-256：
				<code>
					fa772263435bfa388c9ecd811fa834e90decaec1c273565262efdacbb69ece40
				</code>
				。仅公开脱敏摘要与版本指纹，完整 PRD
				和问答保留本机；该指纹不代替运行回执。
			</p>
		</section>
	);
}
