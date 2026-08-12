export function buildApiEndpoint(baseUrl: string, path: string): string {
	return `${baseUrl.replace(/\/$/u, "")}/${path.replace(/^\//u, "")}`;
}

export function readSessionCookie(setCookie: string | null): string {
	const cookie = setCookie?.split(";", 1)[0]?.trim();
	if (!cookie) throw new Error("Worker did not return a session cookie.");
	return cookie;
}

type ClosedLoopFacts = {
	wallet: string;
	taskKey: string;
	draftId: string;
	commentId: string;
	username: string;
	transactionHash: string;
	metadataHash: string;
	cookie?: string;
	signature?: string;
};

export function toPublicEvidence(facts: ClosedLoopFacts) {
	return {
		wallet: facts.wallet,
		taskKey: facts.taskKey,
		draftId: facts.draftId,
		commentId: facts.commentId,
		username: facts.username,
		transactionHash: facts.transactionHash,
		metadataHash: facts.metadataHash,
	};
}
