import { Hero } from "../components/Hero";
import { SafetyNoticeGrid } from "../components/SafetyNoticeGrid";
import { WalletPanel } from "../components/WalletPanel";
import { GrowthPanel } from "../features/growth/GrowthPanel";
import { PointTransferPanel } from "../features/growth/PointTransferPanel";
import { NotebookPanel } from "../features/notebook/NotebookPanel";
import { GuestFirstExperience } from "../features/onboarding/GuestFirstExperience";

export function HomePage() {
	return (
		<>
			<Hero />
			<GuestFirstExperience />
			<SafetyNoticeGrid />
			<details className="advanced-experience">
				<summary>
					<span>进阶体验</span>
					<strong>钱包、成长星与链上记录</strong>
					<small className="advanced-experience__note">
						已实现的 Sepolia 能力，首次体验无需使用
					</small>
				</summary>
				<div className="advanced-experience__content">
					<WalletPanel />
					<GrowthPanel />
					<PointTransferPanel />
					<NotebookPanel />
				</div>
			</details>
		</>
	);
}
