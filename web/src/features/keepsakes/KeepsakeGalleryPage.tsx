import { useEffect, useMemo, useState } from "react";

import { StarBuddy } from "../../components/StarBuddy";
import {
	type KeepsakeCard,
	keepsakeName,
	RARITY_RULES,
	rarityRule,
	seriesRule,
	validateFusionSelection,
} from "./keepsakeModel";
import { useKeepsakes } from "./useKeepsakes";

const EXPLORER_TX_BASE = "https://sepolia.etherscan.io/tx/";

function KeepsakeArtwork({ card }: { card: KeepsakeCard }) {
	const series = seriesRule(card.series);
	return (
		<div className="keepsake-artwork" aria-hidden="true">
			<div className="keepsake-artwork__depth">
				<StarBuddy stage={series.stage} />
			</div>
		</div>
	);
}

export function KeepsakeGalleryPage() {
	const keepsakes = useKeepsakes();
	const [selectedTokenIds, setSelectedTokenIds] = useState<bigint[]>([]);
	const [showCelebration, setShowCelebration] = useState(
		keepsakes.phase === "success",
	);
	const celebrationRequestId =
		keepsakes.phase === "success" ? keepsakes.request?.requestId : undefined;

	useEffect(() => {
		setSelectedTokenIds((current) =>
			current.filter((tokenId) =>
				keepsakes.cards.some(
					(card) => card.tokenId === tokenId && !card.locked,
				),
			),
		);
	}, [keepsakes.cards]);

	useEffect(() => {
		if (!celebrationRequestId) return;
		setShowCelebration(true);
		const reducedMotion = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const timer = window.setTimeout(
			() => setShowCelebration(false),
			reducedMotion ? 150 : 2_100,
		);
		return () => window.clearTimeout(timer);
	}, [celebrationRequestId]);

	const selectedCards = useMemo(
		() =>
			selectedTokenIds
				.map((tokenId) =>
					keepsakes.cards.find((card) => card.tokenId === tokenId),
				)
				.filter((card): card is KeepsakeCard => Boolean(card)),
		[keepsakes.cards, selectedTokenIds],
	);
	const fusion = validateFusionSelection(selectedCards);
	const resultCard = keepsakes.request?.resultTokenId
		? keepsakes.cards.find(
				(card) => card.tokenId === keepsakes.request?.resultTokenId,
			)
		: undefined;
	const canDraw =
		keepsakes.isConfigured &&
		keepsakes.walletState === "ready" &&
		(keepsakes.balance ?? 0n) >= 12n &&
		!keepsakes.isPending;

	function toggleCard(card: KeepsakeCard) {
		if (card.locked) return;
		setSelectedTokenIds((current) => {
			if (current.includes(card.tokenId)) {
				return current.filter((tokenId) => tokenId !== card.tokenId);
			}
			if (current.length >= 3) return current;
			return [...current, card.tokenId];
		});
	}

	return (
		<section
			className="product-page keepsake-page"
			aria-labelledby="keepsake-heading"
		>
			<header className="product-page__hero keepsake-hero">
				<div>
					<p className="product-page__eyebrow">Sepolia · Chainlink VRF</p>
					<h1 id="keepsake-heading">星宝纪念馆</h1>
					<p>
						用可转送成长星抽取随机纪念卡；3 张同系列、同稀有度卡可融合升级。
						卡片是不可转让的纪念凭证，不具有投资或兑现价值。
					</p>
				</div>
				<aside className="keepsake-balance" aria-label="可使用成长星余额">
					<span>可使用成长星</span>
					<strong>{keepsakes.balance?.toString() ?? "—"}</strong>
					<small>每次抽卡固定消耗 12 星</small>
				</aside>
			</header>

			<div className="deployment-status" role="status">
				<span
					className={
						keepsakes.isConfigured
							? "status-dot status-dot--ready"
							: "status-dot"
					}
				/>
				{keepsakes.isConfigured
					? (keepsakes.message ?? "纪念馆合约已配置，结果由 Sepolia VRF 决定。")
					: "Sepolia 合约尚未配置；页面只展示已实现规则，不会伪造卡片或余额。"}
			</div>

			<section className="keepsake-action-grid" aria-label="抽取与融合操作">
				<article className="story-card keepsake-action-card keepsake-action-card--draw">
					<p className="product-page__eyebrow">固定费用 · 随机结果</p>
					<h2>抽取一张纪念卡</h2>
					<p>系列与稀有度分别由两个 VRF 随机数决定，抽到后样式固定。</p>
					<button
						type="button"
						className="button button--web3"
						disabled={!canDraw}
						onClick={() => void keepsakes.draw()}
					>
						{keepsakes.isConfigured
							? "抽取纪念卡 · 12 星"
							: "等待 Sepolia 部署"}
					</button>
				</article>

				<article className="story-card keepsake-action-card keepsake-action-card--fusion">
					<p className="product-page__eyebrow">同系列 · 同稀有度</p>
					<h2>融合升级</h2>
					<p>{fusion.message}</p>
					<button
						type="button"
						className="button button--primary"
						disabled={!fusion.ok || keepsakes.isPending}
						onClick={() =>
							void keepsakes.fuse(selectedTokenIds as [bigint, bigint, bigint])
						}
					>
						融合升级（{selectedTokenIds.length}/3）
					</button>
				</article>
			</section>

			<section
				className="story-card keepsake-rules"
				aria-labelledby="keepsake-rules-heading"
			>
				<div className="story-card__header">
					<div>
						<p className="product-page__eyebrow">公开且可复验</p>
						<h2 id="keepsake-rules-heading">概率与失败规则</h2>
					</div>
					<span className="status-pill status-pill--web3">VRF v2.5</span>
				</div>
				<div className="keepsake-probability-grid">
					{RARITY_RULES.map((rule) => (
						<article
							className={`keepsake-probability keepsake-rarity--${rule.rarity}`}
							key={rule.rarity}
						>
							<strong>{rule.label}</strong>
							<span>抽取 {rule.drawChance}</span>
							<span>融合 {rule.fusionChance}</span>
						</article>
					))}
				</div>
				<p className="keepsake-rule-note">
					融合失败时由第二个随机数销毁 1 张父卡，另 2 张解锁；VRF 超过 24
					小时未返回，可退款 12 星或解锁全部融合卡。
				</p>
			</section>

			<section
				className="story-card keepsake-collection"
				aria-labelledby="keepsake-collection-heading"
			>
				<div className="story-card__header">
					<div>
						<p className="product-page__eyebrow">ERC-5192 · Soulbound</p>
						<h2 id="keepsake-collection-heading">我的纪念卡</h2>
					</div>
					<strong>{keepsakes.cards.length} 张</strong>
				</div>
				{keepsakes.cards.length > 0 ? (
					<div className="keepsake-card-grid">
						{keepsakes.cards.map((card) => {
							const selected = selectedTokenIds.includes(card.tokenId);
							const rarity = rarityRule(card.rarity);
							return (
								<article
									className={`keepsake-card keepsake-rarity--${card.rarity}${selected ? " keepsake-card--selected" : ""}`}
									key={card.tokenId.toString()}
								>
									<KeepsakeArtwork card={card} />
									<div className="keepsake-card__copy">
										<span>{rarity.label}</span>
										<h3>{keepsakeName(card.series, card.rarity)}</h3>
										<small>Token ID #{card.tokenId.toString()}</small>
									</div>
									<button
										type="button"
										aria-label={`选择纪念卡 #${card.tokenId.toString()}`}
										aria-pressed={selected}
										disabled={card.locked}
										onClick={() => toggleCard(card)}
									>
										{card.locked
											? "等待 VRF"
											: selected
												? "已选择"
												: "选择融合"}
									</button>
								</article>
							);
						})}
					</div>
				) : (
					<div className="empty-state">
						<div className="empty-state__buddy" aria-hidden="true">
							☆
						</div>
						<h3>还没有链上纪念卡</h3>
						<p>连接 Sepolia 钱包并完成一次抽取后，真实卡片会出现在这里。</p>
					</div>
				)}
			</section>

			{keepsakes.canRecover && keepsakes.request ? (
				<button
					type="button"
					className="button button--secondary keepsake-recovery"
					onClick={() =>
						void keepsakes.recover(keepsakes.request?.requestId ?? 0n)
					}
				>
					恢复超时请求 #{keepsakes.request.requestId.toString()}
				</button>
			) : null}

			{keepsakes.transactionHash ? (
				<a
					className="inline-link"
					href={`${EXPLORER_TX_BASE}${keepsakes.transactionHash}`}
					target="_blank"
					rel="noreferrer"
				>
					查看 Sepolia 交易
				</a>
			) : null}

			{showCelebration && keepsakes.request?.status === 2 && resultCard ? (
				<div
					className="keepsake-celebration"
					role="status"
					aria-label="融合成功反馈"
					data-full-motion-ms="2100"
					data-reduced-motion-ms="150"
				>
					<div className="keepsake-celebration__glow" aria-hidden="true" />
					<KeepsakeArtwork card={resultCard} />
					<p>融合成功！</p>
					<h2>{keepsakeName(resultCard.series, resultCard.rarity)}</h2>
					<small>新 Token ID #{resultCard.tokenId.toString()}</small>
				</div>
			) : null}
		</section>
	);
}
