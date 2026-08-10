import { hexToBytes } from "viem";
import { describe, expect, it } from "vitest";
import {
	normalizeLowS,
	parseDerSignature,
} from "../src/signing/derSignature.js";

const LOW_DER =
	"0x3045022100b64de0fb219894c62311cb0d34685a22bab1a46fd9290545a5faa264ccd29ec802206c293f624382d5950969bfca3dc31a29cf73824ca4de9074e1b113fe78305bba";
const HIGH_DER =
	"0x3046022100b64de0fb219894c62311cb0d34685a22bab1a46fd9290545a5faa264ccd29ec802210093d6c09dbc7d2a6af6964035c23ce5d4eb3b5a9a0a6a0fc6de214a8e5805e587";

describe("KMS DER signature conversion", () => {
	it("parses the two positive secp256k1 integers", () => {
		expect(parseDerSignature(hexToBytes(LOW_DER))).toEqual({
			r: BigInt(
				"0xb64de0fb219894c62311cb0d34685a22bab1a46fd9290545a5faa264ccd29ec8",
			),
			s: BigInt(
				"0x6c293f624382d5950969bfca3dc31a29cf73824ca4de9074e1b113fe78305bba",
			),
		});
	});

	it("normalizes high-s signatures without changing r", () => {
		const parsed = parseDerSignature(hexToBytes(HIGH_DER));
		expect(normalizeLowS(parsed)).toEqual({
			r: parsed.r,
			s: BigInt(
				"0x6c293f624382d5950969bfca3dc31a29cf73824ca4de9074e1b113fe78305bba",
			),
			wasNormalized: true,
		});
	});

	it("rejects malformed or negative DER integers", () => {
		expect(() => parseDerSignature(hexToBytes("0x3000"))).toThrowError(
			"INVALID_DER_SIGNATURE",
		);
		expect(() =>
			parseDerSignature(hexToBytes("0x3006020180020101")),
		).toThrowError("INVALID_DER_SIGNATURE");
	});
});
