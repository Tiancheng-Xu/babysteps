import { Route, Routes, useLocation } from "react-router-dom";

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
			<CourseEvidenceFooter currentView={currentView} />
		</main>
	);
}
