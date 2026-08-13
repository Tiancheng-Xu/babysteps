import { describe, expect, it } from "vitest";

import { formatBabyCoinAmount } from "./formatBabyCoinAmount";

const UNIT = 10n ** 18n;

describe("formatBabyCoinAmount", () => {
	it("keeps disconnected values out of the numeric display", () => {
		expect(formatBabyCoinAmount(undefined)).toEqual({
			display: "—",
			isApproximate: false,
		});
	});

	it("shows whole BABY values without artificial decimal zeroes", () => {
		expect(formatBabyCoinAmount(27n * UNIT)).toEqual({
			display: "27",
			exact: "27",
			isApproximate: false,
		});
	});

	it("rounds long fractions to four places without using floating point", () => {
		expect(formatBabyCoinAmount(10_650_166_471_630_484_868n)).toEqual({
			display: "10.6502",
			exact: "10.650166471630484868",
			isApproximate: true,
		});
	});

	it("trims trailing fractional zeroes", () => {
		expect(formatBabyCoinAmount(1_250_000_000_000_000_000n)).toEqual({
			display: "1.25",
			exact: "1.25",
			isApproximate: false,
		});
	});

	it("does not present a tiny non-zero balance as zero", () => {
		expect(formatBabyCoinAmount(1n)).toEqual({
			display: "<0.0001",
			exact: "0.000000000000000001",
			isApproximate: true,
		});
	});
});
