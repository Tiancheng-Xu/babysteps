import type { GrowthActivityId } from "./growthModel";
import type { ActivityAvailability, GrowthPhase } from "./useGrowth";

export type ActivityVisualState =
	| "available"
	| "cooldown"
	| "daily-limit"
	| "loading"
	| "read-error"
	| "awaiting-signature"
	| "confirming"
	| "success"
	| "rejected"
	| "write-error";

type ActivityVisualStateInput = {
	activityId: GrowthActivityId;
	availability: ActivityAvailability | undefined;
	isActive: boolean;
	message?: string;
	phase: GrowthPhase;
	walletReady: boolean;
};

export type ResolvedActivityVisualState = {
	state: ActivityVisualState;
	statusMessage: string;
	showButton: boolean;
	buttonDisabled: boolean;
};

const COOLDOWN_COPY: Record<GrowthActivityId, string> = {
	meal: "星宝现在还不饿",
	walk: "星宝正在休息",
	read: "星宝还在回味故事",
};

export function resolveActivityVisualState({
	activityId,
	availability,
	isActive,
	message,
	phase,
	walletReady,
}: ActivityVisualStateInput): ResolvedActivityVisualState {
	if (!walletReady) {
		return {
			state: "loading",
			statusMessage: "先在上方连接 Sepolia 测试钱包，再读取活动状态。",
			showButton: false,
			buttonDisabled: false,
		};
	}

	if (phase === "read-error") {
		return {
			state: "read-error",
			statusMessage: message ?? "读取成长状态失败，请重试。",
			showButton: false,
			buttonDisabled: false,
		};
	}

	if (phase === "reading" || availability === undefined) {
		return {
			state: "loading",
			statusMessage: "正在读取星宝状态",
			showButton: false,
			buttonDisabled: false,
		};
	}

	const transactionPending =
		phase === "awaiting-signature" || phase === "confirming";

	if (transactionPending && isActive) {
		return {
			state: phase,
			statusMessage: message ?? "请先完成当前钱包中的链上操作。",
			showButton: availability.available,
			buttonDisabled: true,
		};
	}

	if (
		isActive &&
		(phase === "success" || phase === "rejected" || phase === "write-error")
	) {
		return {
			state: phase,
			statusMessage: message ?? "本次活动状态已更新。",
			showButton: phase !== "success" && availability.available,
			buttonDisabled: false,
		};
	}

	if (availability.dailyLimitReached) {
		return {
			state: "daily-limit",
			statusMessage: "星宝今天已经很充实了",
			showButton: false,
			buttonDisabled: false,
		};
	}

	if (!availability.available) {
		return {
			state: "cooldown",
			statusMessage: COOLDOWN_COPY[activityId],
			showButton: false,
			buttonDisabled: false,
		};
	}

	return {
		state: "available",
		statusMessage: transactionPending
			? "请先完成当前钱包中的链上操作。"
			: "活动已准备好，可以记录这次陪伴。",
		showButton: true,
		buttonDisabled: transactionPending,
	};
}
