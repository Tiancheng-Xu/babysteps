export type ProductView =
	| "home"
	| "marketplace"
	| "parent"
	| "keepsakes"
	| "provider"
	| "exchange"
	| "profile"
	| "performance"
	| "evidence";

export type RenderPolicy = "public" | "client-shell";

export type RouteDefinition = {
	view: ProductView;
	path: string;
	label: string;
	heading: string;
	renderPolicy: RenderPolicy;
};

export const ROUTE_DEFINITIONS: readonly RouteDefinition[] = [
	{
		view: "home",
		path: "/",
		label: "首页",
		heading: "BabySteps · 成长星球",
		renderPolicy: "public",
	},
	{
		view: "marketplace",
		path: "/tasks",
		label: "成长任务",
		heading: "成长任务市集",
		renderPolicy: "public",
	},
	{
		view: "parent",
		path: "/parent",
		label: "家长中心",
		heading: "家长成长中心",
		renderPolicy: "client-shell",
	},
	{
		view: "keepsakes",
		path: "/keepsakes",
		label: "星宝纪念馆",
		heading: "星宝纪念馆",
		renderPolicy: "public",
	},
	{
		view: "provider",
		path: "/provider",
		label: "Provider 控制台",
		heading: "机构与育婴师控制台",
		renderPolicy: "client-shell",
	},
	{
		view: "exchange",
		path: "/exchange",
		label: "兑换",
		heading: "BabyCoin 兑换",
		renderPolicy: "client-shell",
	},
	{
		view: "profile",
		path: "/profile",
		label: "个人中心",
		heading: "个人中心",
		renderPolicy: "client-shell",
	},
	{
		view: "performance",
		path: "/performance",
		label: "性能观测",
		heading: "BabySteps 性能观测站",
		renderPolicy: "client-shell",
	},
	{
		view: "evidence",
		path: "/evidence",
		label: "工作证据",
		heading: "链上工作证据",
		renderPolicy: "public",
	},
] as const;

export function normalizeRoutePath(pathname: string): string {
	if (pathname === "/") return pathname;
	return pathname.replace(/\/+$/u, "") || "/";
}

export function routeForPath(pathname: string): RouteDefinition | undefined {
	const normalized = normalizeRoutePath(pathname);
	return ROUTE_DEFINITIONS.find((route) => route.path === normalized);
}

export function viewForPath(pathname: string): ProductView | "not-found" {
	return routeForPath(pathname)?.view ?? "not-found";
}
