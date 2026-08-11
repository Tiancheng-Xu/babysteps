export const requiredPrivyLoginMethods = ["google", "email", "wallet"] as const;

export type PublicLinkedAccount = {
	type: string;
	address?: string;
	email?: string;
};

export type IdentitySummary = {
	hasGoogle: boolean;
	hasEmail: boolean;
	externalWallet?: string;
	smartWallet?: string;
};

export function deriveIdentitySummary(
	linkedAccounts: readonly PublicLinkedAccount[],
): IdentitySummary {
	const externalWallet = linkedAccounts.find(
		(account) => account.type === "wallet" && account.address,
	)?.address;
	const smartWallet = linkedAccounts.find(
		(account) => account.type === "smart_wallet" && account.address,
	)?.address;

	return {
		hasGoogle: linkedAccounts.some(
			(account) => account.type === "google_oauth",
		),
		hasEmail: linkedAccounts.some((account) => account.type === "email"),
		externalWallet,
		smartWallet,
	};
}

export function normalizeUsername(value: string): string {
	const username = value.trim();
	const characters = [...username];
	const hasControlCharacter = characters.some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint <= 31 || codePoint === 127;
	});
	if (
		characters.length < 2 ||
		characters.length > 32 ||
		/[<>]/u.test(username) ||
		hasControlCharacter
	) {
		throw new Error("Username must be 2 to 32 safe characters.");
	}
	return username;
}
