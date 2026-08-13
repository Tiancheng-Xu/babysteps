import { formatUnits } from "viem";

const TOKEN_DECIMALS = 18;
const DISPLAY_DECIMALS = 4;
const DISPLAY_SCALE = 10n ** BigInt(DISPLAY_DECIMALS);
const ROUNDING_SCALE = 10n ** BigInt(TOKEN_DECIMALS - DISPLAY_DECIMALS);

export type FormattedBabyCoinAmount = {
	display: string;
	exact?: string;
	isApproximate: boolean;
};

export function formatBabyCoinAmount(
	value: bigint | undefined,
): FormattedBabyCoinAmount {
	if (value === undefined) {
		return { display: "—", isApproximate: false };
	}

	const exact = formatUnits(value, TOKEN_DECIMALS);
	if (value > 0n && value < ROUNDING_SCALE) {
		return { display: "<0.0001", exact, isApproximate: true };
	}

	const roundedDisplayUnits =
		value / ROUNDING_SCALE + ((value % ROUNDING_SCALE) * 2n) / ROUNDING_SCALE;
	const whole = roundedDisplayUnits / DISPLAY_SCALE;
	const fraction = (roundedDisplayUnits % DISPLAY_SCALE)
		.toString()
		.padStart(DISPLAY_DECIMALS, "0")
		.replace(/0+$/u, "");
	const display = fraction ? `${whole}.${fraction}` : whole.toString();

	return { display, exact, isApproximate: display !== exact };
}
