import { useState } from "react";

import { CourseEvidenceFooter } from "./components/CourseEvidenceFooter";
import { Hero } from "./components/Hero";
import {
	ProductNavigation,
	type ProductView,
} from "./components/ProductNavigation";
import { SafetyNoticeGrid } from "./components/SafetyNoticeGrid";
import { WalletPanel } from "./components/WalletPanel";
import { GrowthPanel } from "./features/growth/GrowthPanel";
import { PointTransferPanel } from "./features/growth/PointTransferPanel";
import { NotebookPanel } from "./features/notebook/NotebookPanel";
import { EvidencePage } from "./pages/EvidencePage";
import { ExchangePage } from "./pages/ExchangePage";
import { GrowthMarketplacePage } from "./pages/GrowthMarketplacePage";
import { ParentDashboardPage } from "./pages/ParentDashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProviderConsolePage } from "./pages/ProviderConsolePage";

function HomeView() {
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

export default function App() {
	const [currentView, setCurrentView] = useState<ProductView>("home");

	return (
		<main className="page-shell">
			<ProductNavigation
				currentView={currentView}
				onViewChange={setCurrentView}
			/>
			{currentView === "home" ? <HomeView /> : null}
			{currentView === "marketplace" ? <GrowthMarketplacePage /> : null}
			{currentView === "parent" ? <ParentDashboardPage /> : null}
			{currentView === "provider" ? <ProviderConsolePage /> : null}
			{currentView === "exchange" ? <ExchangePage /> : null}
			{currentView === "profile" ? <ProfilePage /> : null}
			{currentView === "evidence" ? <EvidencePage /> : null}
			<CourseEvidenceFooter currentView={currentView} />
		</main>
	);
}
