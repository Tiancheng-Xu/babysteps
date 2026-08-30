import { NavLink, useLocation } from "react-router-dom";

import { startRouteTransition } from "../performance/routeTransition";
import { ROUTE_DEFINITIONS } from "../routing/routeDefinitions";

export function ProductNavigation() {
	const location = useLocation();
	return (
		<nav className="product-nav" aria-label="BabySteps 产品导航">
			<div className="product-nav__brand" aria-hidden="true">
				<span className="product-nav__star">★</span>
				<span>BabySteps</span>
			</div>
			<div className="product-nav__items">
				{ROUTE_DEFINITIONS.map((item) => (
					<NavLink
						className="product-nav__item"
						end={item.path === "/"}
						key={item.view}
						onClick={() => {
							if (location.pathname !== item.path) startRouteTransition();
						}}
						to={item.view === "evidence" ? "/evidence/" : item.path}
					>
						{item.label}
					</NavLink>
				))}
			</div>
		</nav>
	);
}
