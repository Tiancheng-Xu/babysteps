import { Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { RouteErrorBoundary } from "../app/RouteErrorBoundary";
import { RouteLoading } from "../app/RouteLoading";
import { NotFoundPage, ServerRouteShell } from "../app/ServerRouteShell";
import { CourseEvidenceFooter } from "../components/CourseEvidenceFooter";
import { ProductNavigation } from "../components/ProductNavigation";
import { ROUTE_DEFINITIONS, viewForPath } from "./routeDefinitions";

export function ServerAppRoutes() {
	const location = useLocation();
	const currentView = viewForPath(location.pathname);
	return (
		<main className="page-shell">
			<ProductNavigation />
			<RouteErrorBoundary key={location.pathname}>
				<Suspense fallback={<RouteLoading />}>
					<Routes>
						{ROUTE_DEFINITIONS.map((route) => (
							<Route
								key={route.path}
								path={route.path}
								element={<ServerRouteShell route={route} />}
							/>
						))}
						<Route path="*" element={<NotFoundPage />} />
					</Routes>
				</Suspense>
			</RouteErrorBoundary>
			<CourseEvidenceFooter currentView={currentView} />
		</main>
	);
}
