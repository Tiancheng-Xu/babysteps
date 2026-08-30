let transitionStartedAt: number | undefined;

export function startRouteTransition(startedAt = performance.now()): void {
	transitionStartedAt = startedAt;
}

export function completeRouteTransition(
	completedAt = performance.now(),
): number | undefined {
	const startedAt = transitionStartedAt;
	transitionStartedAt = undefined;
	if (
		startedAt === undefined ||
		!Number.isFinite(startedAt) ||
		!Number.isFinite(completedAt) ||
		completedAt < startedAt
	) {
		return undefined;
	}
	return completedAt - startedAt;
}
