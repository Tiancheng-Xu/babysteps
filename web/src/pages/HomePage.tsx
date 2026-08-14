import { Hero } from "../components/Hero";
import { SafetyNoticeGrid } from "../components/SafetyNoticeGrid";
import { WalletPanel } from "../components/WalletPanel";
import { GrowthPanel } from "../features/growth/GrowthPanel";
import { PointTransferPanel } from "../features/growth/PointTransferPanel";
import { NotebookPanel } from "../features/notebook/NotebookPanel";

export function HomePage() {
	return (
		<>
			<Hero />
			<SafetyNoticeGrid />
			<WalletPanel />
			<GrowthPanel />
			<PointTransferPanel />
			<NotebookPanel />
		</>
	);
}
