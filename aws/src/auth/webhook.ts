import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookAuthErrorCode =
	| "AUTH_MISSING"
	| "AUTH_EXPIRED"
	| "AUTH_REPLAYED"
	| "AUTH_INVALID";

export class WebhookAuthError extends Error {
	readonly code: WebhookAuthErrorCode;

	constructor(code: WebhookAuthErrorCode) {
		super(code);
		this.name = "WebhookAuthError";
		this.code = code;
	}
}

export type WebhookInput = {
	rawBody: string;
	timestamp?: string;
	nonce?: string;
	signature?: string;
};

export type WebhookClaims = {
	timestamp: number;
	nonce: string;
};

export interface NonceStore {
	consume(nonce: string, expiresAt: Date): Promise<boolean>;
}

export type WebhookOptions = {
	secret: string;
	nonceStore: NonceStore;
	now?: () => Date;
	toleranceSeconds?: number;
};

const DEFAULT_TOLERANCE_SECONDS = 300;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const UNIX_SECONDS_PATTERN = /^\d{1,12}$/;

export async function verifyWebhook(
	input: WebhookInput,
	options: WebhookOptions,
): Promise<WebhookClaims> {
	const { timestamp, nonce, signature } = input;
	if (!timestamp || !nonce || !signature) {
		throw new WebhookAuthError("AUTH_MISSING");
	}

	if (
		!UNIX_SECONDS_PATTERN.test(timestamp) ||
		!SHA256_HEX_PATTERN.test(signature)
	) {
		throw new WebhookAuthError("AUTH_INVALID");
	}

	const timestampSeconds = Number(timestamp);
	const nowSeconds = Math.floor(
		(options.now?.() ?? new Date()).getTime() / 1000,
	);
	const toleranceSeconds =
		options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
	if (
		!Number.isSafeInteger(timestampSeconds) ||
		!Number.isSafeInteger(toleranceSeconds) ||
		toleranceSeconds < 0 ||
		Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds
	) {
		throw new WebhookAuthError("AUTH_EXPIRED");
	}

	const expected = createHmac("sha256", options.secret)
		.update(`${timestamp}.${nonce}.${input.rawBody}`)
		.digest();
	const actual = Buffer.from(signature, "hex");
	if (!timingSafeEqual(actual, expected)) {
		throw new WebhookAuthError("AUTH_INVALID");
	}

	const expiresAt = new Date((timestampSeconds + toleranceSeconds) * 1000);
	if (!(await options.nonceStore.consume(nonce, expiresAt))) {
		throw new WebhookAuthError("AUTH_REPLAYED");
	}

	return { timestamp: timestampSeconds, nonce };
}
