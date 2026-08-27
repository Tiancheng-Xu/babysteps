import { BrowserRouter } from "react-router-dom";

import { CourseEvidenceFooter } from "./components/CourseEvidenceFooter";
import { Hero } from "./components/Hero";
import { SafetyNoticeGrid } from "./components/SafetyNoticeGrid";
import { WalletPanel } from "./components/WalletPanel";
import { GrowthPanel } from "./features/growth/GrowthPanel";
import { PointTransferPanel } from "./features/growth/PointTransferPanel";
import { NotebookPanel } from "./features/notebook/NotebookPanel";
import { AppRoutes } from "./routing/routes";

export function LegacySinglePageApp() {
	return (
		<main className="page-shell">
			<Hero />
			<SafetyNoticeGrid />
			<WalletPanel />
			<GrowthPanel />
			<PointTransferPanel />
			<NotebookPanel />
			<CourseEvidenceFooter currentView="home" />
		</main>
	);
}

export default function App({ interactive = true }: { interactive?: boolean }) {
	return (
		<BrowserRouter>
			<AppRoutes interactive={interactive} />
		</BrowserRouter>
	);
}
