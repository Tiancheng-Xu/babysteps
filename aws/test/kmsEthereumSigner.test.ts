import {
	hexToBytes,
	keccak256,
	parseTransaction,
	recoverAddress,
	serializeTransaction,
	type TransactionSerializableEIP1559,
} from "viem";
import { describe, expect, it } from "vitest";
import {
	KmsEthereumSigner,
	type KmsLike,
} from "../src/signing/kmsEthereumSigner.js";

const EXPECTED_ADDRESS = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const PUBLIC_KEY_DER =
	"0x3056301006072a8648ce3d020106052b8104000a0342000479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8";
const SIGNATURE_DER =
	"0x3045022100b64de0fb219894c62311cb0d34685a22bab1a46fd9290545a5faa264ccd29ec802206c293f624382d5950969bfca3dc31a29cf73824ca4de9074e1b113fe78305bba";
const EXPECTED_SIGNED_TRANSACTION =
	"0x02f86583aa36a780010282520894000000000000000000000000000000000000dead0180c001a0b64de0fb219894c62311cb0d34685a22bab1a46fd9290545a5faa264ccd29ec8a06c293f624382d5950969bfca3dc31a29cf73824ca4de9074e1b113fe78305bba";

const transaction: TransactionSerializableEIP1559 = {
	type: "eip1559",
	chainId: 11_155_111,
	nonce: 0,
	maxFeePerGas: 2n,
	maxPriorityFeePerGas: 1n,
	gas: 21_000n,
	to: "0x000000000000000000000000000000000000dEaD",
	value: 1n,
};

class FixtureKms implements KmsLike {
	readonly publicKeyCalls: unknown[] = [];
	readonly signCalls: unknown[] = [];

	async getPublicKey(input: { KeyId: string }) {
		this.publicKeyCalls.push(input);
		return { PublicKey: hexToBytes(PUBLIC_KEY_DER) };
	}

	async sign(input: {
		KeyId: string;
		Message: Uint8Array;
		MessageType: "DIGEST";
		SigningAlgorithm: "ECDSA_SHA_256";
	}) {
		this.signCalls.push(input);
		return { Signature: hexToBytes(SIGNATURE_DER) };
	}
}

describe("KmsEthereumSigner", () => {
	it("derives the checksummed Ethereum address from KMS SPKI", async () => {
		const kms = new FixtureKms();
		const signer = new KmsEthereumSigner(kms, "fixture-key-id");

		await expect(signer.getAddress()).resolves.toBe(EXPECTED_ADDRESS);
		expect(kms.publicKeyCalls).toEqual([{ KeyId: "fixture-key-id" }]);
	});

	it("signs the Keccak EIP-1559 digest and selects the recovering y parity", async () => {
		const kms = new FixtureKms();
		const signer = new KmsEthereumSigner(kms, "fixture-key-id");

		await expect(signer.signTransaction(transaction)).resolves.toBe(
			EXPECTED_SIGNED_TRANSACTION,
		);
		const unsigned = serializeTransaction(transaction);
		expect(kms.signCalls).toEqual([
			{
				KeyId: "fixture-key-id",
				Message: hexToBytes(keccak256(unsigned)),
				MessageType: "DIGEST",
				SigningAlgorithm: "ECDSA_SHA_256",
			},
		]);

		const parsed = parseTransaction(EXPECTED_SIGNED_TRANSACTION);
		if (
			parsed.r === undefined ||
			parsed.s === undefined ||
			parsed.yParity === undefined
		) {
			throw new Error("fixture transaction is not signed");
		}
		await expect(
			recoverAddress({
				hash: keccak256(unsigned),
				signature: {
					r: parsed.r,
					s: parsed.s,
					yParity: parsed.yParity,
				},
			}),
		).resolves.toBe(EXPECTED_ADDRESS);
	});
});
