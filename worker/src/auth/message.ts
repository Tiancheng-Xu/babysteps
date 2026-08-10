import type { AppConfig } from "../config";

export type AuthMessageInput = {
	address: string;
	action: string;
	nonce: string;
	issuedAt: number;
	expiresAt: number;
};

export function buildAuthMessage(
	config: AppConfig,
	input: AuthMessageInput,
): string {
	return [
		"BabySteps wants you to sign in",
		`Domain: ${config.domain}`,
		`URI: ${config.uri}`,
		`Address: ${input.address}`,
		`Chain ID: ${config.chainId}`,
		`Nonce: ${input.nonce}`,
		`Action: ${input.action}`,
		`Issued At: ${new Date(input.issuedAt * 1000).toISOString()}`,
		`Expiration Time: ${new Date(input.expiresAt * 1000).toISOString()}`,
	].join("\n");
}
