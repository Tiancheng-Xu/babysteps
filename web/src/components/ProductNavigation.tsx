import { NavLink } from "react-router-dom";

import { ROUTE_DEFINITIONS } from "../routing/routeDefinitions";

export function ProductNavigation() {
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
						to={item.view === "evidence" ? "/evidence/" : item.path}
					>
						{item.label}
					</NavLink>
				))}
			</div>
		</nav>
	);
}
