export const SECP256K1_ORDER = BigInt(
	"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
const SECP256K1_HALF_ORDER = SECP256K1_ORDER / 2n;

export type Secp256k1Signature = {
	r: bigint;
	s: bigint;
};

export type NormalizedSecp256k1Signature = Secp256k1Signature & {
	wasNormalized: boolean;
};

export function parseDerSignature(bytes: Uint8Array): Secp256k1Signature {
	try {
		let offset = 0;
		if (bytes[offset++] !== 0x30) throw new Error("sequence");
		const sequence = readLength(bytes, offset);
		offset = sequence.offset;
		if (offset + sequence.length !== bytes.length) throw new Error("length");

		const rResult = readInteger(bytes, offset);
		offset = rResult.offset;
		const sResult = readInteger(bytes, offset);
		offset = sResult.offset;
		if (offset !== bytes.length) throw new Error("trailing");
		if (
			rResult.value <= 0n ||
			rResult.value >= SECP256K1_ORDER ||
			sResult.value <= 0n ||
			sResult.value >= SECP256K1_ORDER
		) {
			throw new Error("range");
		}
		return { r: rResult.value, s: sResult.value };
	} catch {
		throw new Error("INVALID_DER_SIGNATURE");
	}
}

export function normalizeLowS(
	signature: Secp256k1Signature,
): NormalizedSecp256k1Signature {
	if (signature.s <= SECP256K1_HALF_ORDER) {
		return { ...signature, wasNormalized: false };
	}
	return {
		r: signature.r,
		s: SECP256K1_ORDER - signature.s,
		wasNormalized: true,
	};
}

function readLength(bytes: Uint8Array, offset: number) {
	const first = bytes[offset];
	if (first === undefined) throw new Error("missing length");
	if (first < 0x80) return { length: first, offset: offset + 1 };

	const width = first & 0x7f;
	if (width === 0 || width > 2 || offset + width >= bytes.length) {
		throw new Error("invalid length");
	}
	let length = 0;
	for (let index = 0; index < width; index += 1) {
		length = length * 256 + (bytes[offset + 1 + index] ?? 0);
	}
	if (length < 0x80) throw new Error("non-canonical length");
	return { length, offset: offset + 1 + width };
}

function readInteger(bytes: Uint8Array, offset: number) {
	if (bytes[offset++] !== 0x02) throw new Error("integer");
	const encoded = readLength(bytes, offset);
	offset = encoded.offset;
	if (encoded.length === 0 || offset + encoded.length > bytes.length) {
		throw new Error("integer length");
	}
	const integer = bytes.slice(offset, offset + encoded.length);
	if ((integer[0] ?? 0) & 0x80) throw new Error("negative integer");
	if (
		integer.length > 1 &&
		integer[0] === 0 &&
		((integer[1] ?? 0) & 0x80) === 0
	) {
		throw new Error("non-canonical integer");
	}
	let value = 0n;
	for (const byte of integer) value = value * 256n + BigInt(byte);
	return { value, offset: offset + encoded.length };
}
