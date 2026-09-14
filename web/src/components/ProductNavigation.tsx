import { NavLink, useLocation } from "react-router-dom";

import { startRouteTransition } from "../performance/routeTransition";
import { ROUTE_DEFINITIONS } from "../routing/routeDefinitions";

const SECONDARY_VIEWS = new Set([
	"provider",
	"exchange",
	"performance",
	"evidence",
]);

const COMPACT_LABELS: Record<string, string> = {
	provider: "机构端",
	exchange: "链上兑换",
	performance: "性能",
	evidence: "证据",
};

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
						aria-label={item.label}
						className="product-nav__item"
						end={item.path === "/"}
						key={item.view}
						onClick={() => {
							if (location.pathname !== item.path) startRouteTransition();
						}}
						to={item.view === "evidence" ? "/evidence/" : item.path}
					>
						<span>{COMPACT_LABELS[item.view] ?? item.label}</span>
						{SECONDARY_VIEWS.has(item.view) ? (
							<small className="product-nav__tag" aria-hidden="true">
								{item.view === "evidence" ? "证明" : "进阶"}
							</small>
						) : null}
					</NavLink>
				))}
			</div>
		</nav>
	);
}
