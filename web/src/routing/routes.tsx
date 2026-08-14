import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "../app/RouteErrorBoundary";
import { RouteLoading } from "../app/RouteLoading";
import { NotFoundPage, ServerRouteShell } from "../app/ServerRouteShell";
import { CourseEvidenceFooter } from "../components/CourseEvidenceFooter";
import { ProductNavigation } from "../components/ProductNavigation";
import { HomePage } from "../pages/HomePage";
import { ROUTE_DEFINITIONS, viewForPath } from "./routeDefinitions";

const GrowthMarketplacePage = lazy(() =>
	import("../pages/GrowthMarketplacePage").then((module) => ({
		default: module.GrowthMarketplacePage,
	})),
);
const ParentDashboardPage = lazy(() =>
	import("../pages/ParentDashboardPage").then((module) => ({
		default: module.ParentDashboardPage,
	})),
);
const KeepsakeGalleryPage = lazy(() =>
	import("../features/keepsakes/KeepsakeGalleryPage").then((module) => ({
		default: module.KeepsakeGalleryPage,
	})),
);
const ProviderConsolePage = lazy(() =>
	import("../pages/ProviderConsolePage").then((module) => ({
		default: module.ProviderConsolePage,
	})),
);
const ExchangePage = lazy(() =>
	import("../pages/ExchangePage").then((module) => ({
		default: module.ExchangePage,
	})),
);
const ProfilePage = lazy(() =>
	import("../pages/ProfilePage").then((module) => ({
		default: module.ProfilePage,
	})),
);
const PerformanceDashboardPage = lazy(() =>
	import("../pages/PerformanceDashboardPage").then((module) => ({
		default: module.PerformanceDashboardPage,
	})),
);
const EvidencePage = lazy(() =>
	import("../pages/EvidencePage").then((module) => ({
		default: module.EvidencePage,
	})),
);

const INTERACTIVE_COMPONENTS = {
	home: HomePage,
	marketplace: GrowthMarketplacePage,
	parent: ParentDashboardPage,
	keepsakes: KeepsakeGalleryPage,
	provider: ProviderConsolePage,
	exchange: ExchangePage,
	profile: ProfilePage,
	performance: PerformanceDashboardPage,
	evidence: EvidencePage,
} as const;

export function AppRoutes({ interactive = true }: { interactive?: boolean }) {
	const location = useLocation();
	const currentView = viewForPath(location.pathname);

	useEffect(() => {
		document.documentElement.dataset.currentView = currentView;
	}, [currentView]);

	return (
		<main className="page-shell">
			<ProductNavigation />
			<RouteErrorBoundary key={location.pathname}>
				<Suspense fallback={<RouteLoading />}>
					<Routes>
						{ROUTE_DEFINITIONS.map((route) => {
							const InteractiveComponent = INTERACTIVE_COMPONENTS[route.view];
							return (
								<Route
									key={route.path}
									path={route.path}
									element={
										interactive ? (
											<InteractiveComponent />
										) : (
											<ServerRouteShell route={route} />
										)
									}
								/>
							);
						})}
						<Route path="*" element={<NotFoundPage />} />
					</Routes>
				</Suspense>
			</RouteErrorBoundary>
			<CourseEvidenceFooter currentView={currentView} />
		</main>
	);
}
