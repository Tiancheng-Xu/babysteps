function randomBytes(length: number): Uint8Array {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}

export function randomHex(length: number): string {
	return [...randomBytes(length)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function randomToken(): string {
	const binary = String.fromCharCode(...randomBytes(32));
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/u, "");
}
