export type ProductView =
	| "home"
	| "marketplace"
	| "parent"
	| "provider"
	| "exchange"
	| "profile"
	| "evidence";

const NAVIGATION_ITEMS: Array<{ id: ProductView; label: string }> = [
	{ id: "home", label: "首页" },
	{ id: "marketplace", label: "成长任务" },
	{ id: "parent", label: "家长中心" },
	{ id: "provider", label: "Provider 控制台" },
	{ id: "exchange", label: "兑换" },
	{ id: "profile", label: "个人中心" },
	{ id: "evidence", label: "工作证据" },
];

export function ProductNavigation({
	currentView,
	onViewChange,
}: {
	currentView: ProductView;
	onViewChange: (view: ProductView) => void;
}) {
	return (
		<nav className="product-nav" aria-label="BabySteps 产品导航">
			<div className="product-nav__brand" aria-hidden="true">
				<span className="product-nav__star">★</span>
				<span>BabySteps</span>
			</div>
			<div className="product-nav__items">
				{NAVIGATION_ITEMS.map((item) => (
					<button
						type="button"
						className="product-nav__item"
						aria-current={currentView === item.id ? "page" : undefined}
						key={item.id}
						onClick={() => onViewChange(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
		</nav>
	);
}
