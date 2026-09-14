export type BabyStage = "newborn" | "infant" | "crawler" | "toddler";
export type TrialMarket = "china" | "japan";
export type TrialCity =
	| "ningbo"
	| "shanghai"
	| "hangzhou"
	| "tokyo"
	| "osaka"
	| "other";

export type GuestTask = {
	id: string;
	title: string;
	description: string;
	steps: readonly string[];
	durationMinutes: 3;
};

export type GuestJourney = {
	version: 1;
	stage: BabyStage;
	market: TrialMarket;
	city: TrialCity;
	taskId: string;
	status: "started" | "completed";
	startedAt: string;
};

export const GUEST_JOURNEY_STORAGE_KEY = "babysteps.guest-journey.v1";

export const BABY_STAGE_OPTIONS: readonly {
	value: BabyStage;
	label: string;
}[] = [
	{ value: "newborn", label: "0–3 个月" },
	{ value: "infant", label: "4–6 个月" },
	{ value: "crawler", label: "7–12 个月" },
	{ value: "toddler", label: "1–3 岁" },
];

export const MARKET_OPTIONS: readonly { value: TrialMarket; label: string }[] =
	[
		{ value: "china", label: "中国" },
		{ value: "japan", label: "日本" },
	];

export const CITY_OPTIONS: Readonly<
	Record<TrialMarket, readonly { value: TrialCity; label: string }[]>
> = {
	china: [
		{ value: "ningbo", label: "宁波" },
		{ value: "shanghai", label: "上海" },
		{ value: "hangzhou", label: "杭州" },
		{ value: "other", label: "其他城市" },
	],
	japan: [
		{ value: "tokyo", label: "东京" },
		{ value: "osaka", label: "大阪" },
		{ value: "other", label: "其他城市" },
	],
};

const TASKS: Readonly<Record<BabyStage, GuestTask>> = {
	newborn: {
		id: "newborn-voice",
		title: "听见你的声音",
		description: "用熟悉的声音和目光，给宝宝一段安静、可重复的陪伴。",
		steps: [
			"抱稳或让宝宝舒适躺好",
			"轻声描述今天的一件小事",
			"停下来回应宝宝的表情或声音",
		],
		durationMinutes: 3,
	},
	infant: {
		id: "infant-texture",
		title: "触感小探索",
		description: "用家中安全、柔软的物品，陪宝宝感受两种不同触感。",
		steps: [
			"准备两件干净柔软的物品",
			"让宝宝分别触摸并说出感受",
			"用微笑和声音回应宝宝",
		],
		durationMinutes: 3,
	},
	crawler: {
		id: "crawler-follow",
		title: "跟着星星找一找",
		description: "把熟悉玩具放在可见范围，鼓励宝宝用自己的方式靠近。",
		steps: [
			"选择一件安全熟悉的玩具",
			"放在宝宝能看到的位置",
			"陪伴移动并庆祝每一步尝试",
		],
		durationMinutes: 3,
	},
	toddler: {
		id: "toddler-treasure",
		title: "寻找家的颜色",
		description: "和孩子一起在家里寻找三种颜色，说出它们属于什么物品。",
		steps: ["一起选定一种颜色", "寻找三个同色物品", "请孩子说出最喜欢的一个"],
		durationMinutes: 3,
	},
};

const STAGES = new Set<BabyStage>(BABY_STAGE_OPTIONS.map(({ value }) => value));
const MARKETS = new Set<TrialMarket>(MARKET_OPTIONS.map(({ value }) => value));
export function guestTaskFor(stage: BabyStage): GuestTask {
	return TASKS[stage];
}

function isGuestJourney(value: unknown): value is GuestJourney {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<GuestJourney>;
	const market = candidate.market;
	const city = candidate.city;
	if (
		candidate.version !== 1 ||
		!candidate.stage ||
		!STAGES.has(candidate.stage) ||
		!market ||
		!MARKETS.has(market) ||
		!city ||
		!CITY_OPTIONS[market].some((option) => option.value === city) ||
		(candidate.status !== "started" && candidate.status !== "completed") ||
		typeof candidate.startedAt !== "string" ||
		Number.isNaN(Date.parse(candidate.startedAt))
	) {
		return false;
	}
	return candidate.taskId === guestTaskFor(candidate.stage).id;
}

function browserStorage(): Storage | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function loadGuestJourney(): GuestJourney | undefined {
	const storage = browserStorage();
	if (!storage) return undefined;
	try {
		const raw = storage.getItem(GUEST_JOURNEY_STORAGE_KEY);
		if (!raw) return undefined;
		const parsed: unknown = JSON.parse(raw);
		if (isGuestJourney(parsed)) return parsed;
		storage.removeItem(GUEST_JOURNEY_STORAGE_KEY);
	} catch {
		storage.removeItem(GUEST_JOURNEY_STORAGE_KEY);
	}
	return undefined;
}

export function saveGuestJourney(journey: GuestJourney): void {
	if (!isGuestJourney(journey)) return;
	try {
		browserStorage()?.setItem(
			GUEST_JOURNEY_STORAGE_KEY,
			JSON.stringify(journey),
		);
	} catch {
		// The first experience remains usable when browser storage is unavailable.
	}
}

export function clearGuestJourney(): void {
	try {
		browserStorage()?.removeItem(GUEST_JOURNEY_STORAGE_KEY);
	} catch {
		// Nothing else should be cleared when browser storage is unavailable.
	}
}
