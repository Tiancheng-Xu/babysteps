import { type Address, getAddress } from "viem";

function integerSquareRoot(value: bigint): bigint {
	if (value < 0n) throw new Error("Square root input cannot be negative.");
	if (value < 2n) return value;
	let current = value;
	let next = (current + value / current) / 2n;
	while (next < current) {
		current = next;
		next = (current + value / current) / 2n;
	}
	return current;
}

export function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
	if (amount0 <= 0n || amount1 <= 0n) {
		throw new Error("Pool initialization amounts must be positive.");
	}
	return integerSquareRoot((amount1 << 192n) / amount0);
}

export function sortPairAmounts(
	tokenA: Address,
	tokenB: Address,
	amountA: bigint,
	amountB: bigint,
): { token0: Address; token1: Address; amount0: bigint; amount1: bigint } {
	const normalizedA = getAddress(tokenA);
	const normalizedB = getAddress(tokenB);
	if (normalizedA.toLowerCase() === normalizedB.toLowerCase()) {
		throw new Error("Uniswap pool tokens must be different.");
	}
	if (BigInt(normalizedA) < BigInt(normalizedB)) {
		return {
			token0: normalizedA,
			token1: normalizedB,
			amount0: amountA,
			amount1: amountB,
		};
	}
	return {
		token0: normalizedB,
		token1: normalizedA,
		amount0: amountB,
		amount1: amountA,
	};
}
