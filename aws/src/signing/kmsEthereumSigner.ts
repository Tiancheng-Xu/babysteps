import { createPublicKey } from "node:crypto";
import {
	type Address,
	bytesToHex,
	type Hex,
	hexToBytes,
	keccak256,
	numberToHex,
	recoverAddress,
	serializeTransaction,
	type TransactionSerializableEIP1559,
} from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { normalizeLowS, parseDerSignature } from "./derSignature.js";
import type { EthereumSigner } from "./ethereumSigner.js";

export interface KmsLike {
	getPublicKey(input: { KeyId: string }): Promise<{ PublicKey?: Uint8Array }>;
	sign(input: {
		KeyId: string;
		Message: Uint8Array;
		MessageType: "DIGEST";
		SigningAlgorithm: "ECDSA_SHA_256";
	}): Promise<{ Signature?: Uint8Array }>;
}

export class KmsEthereumSigner implements EthereumSigner {
	private address?: Address;

	constructor(
		private readonly kms: KmsLike,
		private readonly keyId: string,
	) {}

	async getAddress(): Promise<Address> {
		if (this.address) return this.address;
		const response = await this.kms.getPublicKey({ KeyId: this.keyId });
		if (!response.PublicKey) throw new Error("KMS_PUBLIC_KEY_MISSING");
		this.address = publicKeyToAddress(
			spkiToSecp256k1PublicKey(response.PublicKey),
		);
		return this.address;
	}

	async signTransaction(
		transaction: TransactionSerializableEIP1559,
	): Promise<Hex> {
		const unsigned = serializeTransaction(transaction);
		const digest = keccak256(unsigned);
		const response = await this.kms.sign({
			KeyId: this.keyId,
			Message: hexToBytes(digest),
			MessageType: "DIGEST",
			SigningAlgorithm: "ECDSA_SHA_256",
		});
		if (!response.Signature) throw new Error("KMS_SIGNATURE_MISSING");

		const { r, s } = normalizeLowS(parseDerSignature(response.Signature));
		const signatureBase = {
			r: numberToHex(r, { size: 32 }),
			s: numberToHex(s, { size: 32 }),
		};
		const expectedAddress = await this.getAddress();
		for (const yParity of [0, 1] as const) {
			const recovered = await recoverAddress({
				hash: digest,
				signature: { ...signatureBase, yParity },
			});
			if (recovered === expectedAddress) {
				return serializeTransaction(transaction, {
					...signatureBase,
					yParity,
				});
			}
		}
		throw new Error("KMS_SIGNATURE_RECOVERY_FAILED");
	}
}

function spkiToSecp256k1PublicKey(spki: Uint8Array): Hex {
	const key = createPublicKey({
		key: Buffer.from(spki),
		format: "der",
		type: "spki",
	});
	const jwk = key.export({ format: "jwk" });
	if (!jwk.x || !jwk.y || jwk.crv !== "secp256k1") {
		throw new Error("KMS_PUBLIC_KEY_INVALID");
	}
	const x = Buffer.from(jwk.x, "base64url");
	const y = Buffer.from(jwk.y, "base64url");
	if (x.length !== 32 || y.length !== 32) {
		throw new Error("KMS_PUBLIC_KEY_INVALID");
	}
	return bytesToHex(Buffer.concat([Buffer.from([4]), x, y]));
}
