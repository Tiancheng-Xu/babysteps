import type { Address } from "viem";

const BASIS_POINTS = 10_000n;

export function applySlippageFloor(
	quotedAmountOut: bigint,
	slippageBps: number,
): bigint {
	if (
		!Number.isInteger(slippageBps) ||
		slippageBps < 0 ||
		slippageBps >= Number(BASIS_POINTS)
	) {
		throw new Error(
			"Uniswap slippage must be between 0 and 9,999 basis points.",
		);
	}
	return (
		(quotedAmountOut * (BASIS_POINTS - BigInt(slippageBps))) / BASIS_POINTS
	);
}

export function finiteApprovalAmount(amountIn: bigint): bigint {
	if (amountIn <= 0n) throw new Error("Approval amount must be positive.");
	return amountIn;
}

export type ExactInputSingle = {
	tokenIn: Address;
	tokenOut: Address;
	fee: number;
	recipient: Address;
	amountIn: bigint;
	amountOutMinimum: bigint;
	sqrtPriceLimitX96: bigint;
};

export function buildExactInputSingle(input: {
	tokenIn: Address;
	tokenOut: Address;
	fee: number;
	recipient: Address;
	amountIn: bigint;
	quotedAmountOut: bigint;
	slippageBps: number;
}): ExactInputSingle {
	if (input.amountIn <= 0n)
		throw new Error("Swap input amount must be positive.");
	return {
		tokenIn: input.tokenIn,
		tokenOut: input.tokenOut,
		fee: input.fee,
		recipient: input.recipient,
		amountIn: input.amountIn,
		amountOutMinimum: applySlippageFloor(
			input.quotedAmountOut,
			input.slippageBps,
		),
		sqrtPriceLimitX96: 0n,
	};
}
