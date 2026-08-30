import {
	readContract,
	simulateContract,
	waitForTransactionReceipt,
} from "@wagmi/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { getAddress, type Hash, parseUnits } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";

import { wagmiConfig } from "../../config/wagmi";
import {
	babyCoinAddress,
	exchangeErc20Abi,
	uniswapQuoterV2Abi,
	uniswapSwapRouter02Abi,
	uniswapV3Sepolia,
	weth9Abi,
} from "../../contracts/web3Contracts";
import { toWalletMessage } from "../../lib/walletError";
import {
	measureBusinessPerformance,
	measurePerformance,
} from "../../performance/runtime";
import { formatBabyCoinAmount } from "../babycoin/formatBabyCoinAmount";
import { deriveWalletState, hasMetaMaskProvider } from "../wallet/walletState";
import { buildExactInputSingle, finiteApprovalAmount } from "./uniswapModel";

export type ExchangeAsset = "USDC" | "ETH";
type ExchangePhase =
	| "idle"
	| "quoting"
	| "quoted"
	| "wrapping"
	| "approving"
	| "swapping"
	| "success"
	| "error";

const assetConfig = {
	USDC: { address: uniswapV3Sepolia.usdc, decimals: 6 },
	ETH: { address: uniswapV3Sepolia.weth, decimals: 18 },
} as const;

export function useUniswapSwap() {
	const { address, chainId, isConnected } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { writeContractAsync } = useWriteContract();
	const [asset, setAsset] = useState<ExchangeAsset>("USDC");
	const [amount, setAmount] = useState("1");
	const [quotedAmountOut, setQuotedAmountOut] = useState<bigint>();
	const [quotedInput, setQuotedInput] = useState<bigint>();
	const [phase, setPhase] = useState<ExchangePhase>("idle");
	const [message, setMessage] = useState<string>();
	const [transactionHash, setTransactionHash] = useState<Hash>();
	const pendingRef = useRef(false);

	const walletState = deriveWalletState({
		hasProvider: hasMetaMaskProvider(),
		isConnected,
		address,
		chainId,
	});
	const selected = assetConfig[asset];
	const amountIn = useMemo(() => {
		try {
			return parseUnits(amount, selected.decimals);
		} catch {
			return undefined;
		}
	}, [amount, selected.decimals]);
	const configured = Boolean(babyCoinAddress);
	const formattedQuote = formatBabyCoinAmount(quotedAmountOut);

	const quote = useCallback(() => {
		const targetToken = babyCoinAddress;
		if (!targetToken || !amountIn || amountIn <= 0n) {
			setPhase("error");
			setMessage("请输入有效数量，并先配置 BABY 合约地址。");
			return Promise.resolve();
		}
		return measureBusinessPerformance("business.exchange.quote", () =>
			measurePerformance("web3.uniswap.quote", async () => {
				setPhase("quoting");
				setMessage("正在从 Sepolia Uniswap v3 QuoterV2 读取报价…");
				try {
					const simulation = await measurePerformance("contract.read", () =>
						simulateContract(wagmiConfig, {
							address: uniswapV3Sepolia.quoterV2,
							abi: uniswapQuoterV2Abi,
							functionName: "quoteExactInputSingle",
							args: [
								{
									tokenIn: selected.address,
									tokenOut: targetToken,
									amountIn,
									fee: uniswapV3Sepolia.fee,
									sqrtPriceLimitX96: 0n,
								},
							],
							chainId: sepolia.id,
						}),
					);
					const result = simulation.result;
					const output = Array.isArray(result) ? result[0] : undefined;
					if (typeof output !== "bigint" || output <= 0n) {
						throw new Error("池尚无可用流动性或未返回有效报价。");
					}
					setQuotedInput(amountIn);
					setQuotedAmountOut(output);
					setPhase("quoted");
					setMessage("报价已读取；执行时按 1% 最大滑点保护最小到账量。");
				} catch (error) {
					setPhase("error");
					setMessage(toWalletMessage(error));
					throw error;
				}
			}),
		);
	}, [amountIn, selected.address]);

	const execute = useCallback(() => {
		const targetToken = babyCoinAddress;
		if (
			pendingRef.current ||
			!address ||
			!targetToken ||
			!amountIn ||
			amountIn !== quotedInput ||
			!quotedAmountOut ||
			walletState !== "ready"
		) {
			return Promise.resolve();
		}
		return measureBusinessPerformance("business.exchange.swap", () =>
			measurePerformance("web3.uniswap.swap", async () => {
				pendingRef.current = true;
				setTransactionHash(undefined);
				try {
					if (asset === "ETH") {
						const wethBalance = await readContract(wagmiConfig, {
							address: uniswapV3Sepolia.weth,
							abi: weth9Abi,
							functionName: "balanceOf",
							args: [address],
							chainId: sepolia.id,
						});
						if (wethBalance < amountIn) {
							setPhase("wrapping");
							setMessage("WETH 不足：请确认将差额测试 ETH 包装为 WETH。");
							const wrapHash = await writeContractAsync({
								address: uniswapV3Sepolia.weth,
								abi: weth9Abi,
								functionName: "deposit",
								value: amountIn - wethBalance,
								chainId: sepolia.id,
							});
							await waitForTransactionReceipt(wagmiConfig, {
								hash: wrapHash,
								chainId: sepolia.id,
							});
						}
					}

					const allowance = await readContract(wagmiConfig, {
						address: selected.address,
						abi: exchangeErc20Abi,
						functionName: "allowance",
						args: [address, uniswapV3Sepolia.swapRouter02],
						chainId: sepolia.id,
					});
					if (allowance < amountIn) {
						setPhase("approving");
						setMessage("请确认仅授权本次输入数量，不使用无限授权。");
						const approvalHash = await measurePerformance(
							"approve.submit",
							() =>
								measurePerformance("contract.write", () =>
									writeContractAsync({
										address: selected.address,
										abi: exchangeErc20Abi,
										functionName: "approve",
										args: [
											uniswapV3Sepolia.swapRouter02,
											finiteApprovalAmount(amountIn),
										],
										chainId: sepolia.id,
									}),
								),
						);
						await measurePerformance("approve.receipt", () =>
							waitForTransactionReceipt(wagmiConfig, {
								hash: approvalHash,
								chainId: sepolia.id,
							}),
						);
					}

					setPhase("swapping");
					setMessage("请确认 Uniswap v3 SwapRouter02 交易。");
					const params = buildExactInputSingle({
						tokenIn: getAddress(selected.address),
						tokenOut: targetToken,
						fee: uniswapV3Sepolia.fee,
						recipient: address,
						amountIn,
						quotedAmountOut,
						slippageBps: 100,
					});
					const simulation = await simulateContract(wagmiConfig, {
						address: uniswapV3Sepolia.swapRouter02,
						abi: uniswapSwapRouter02Abi,
						functionName: "exactInputSingle",
						args: [params],
						account: address,
						chainId: sepolia.id,
					});
					const hash = await measurePerformance("transaction.submit", () =>
						measurePerformance("contract.write", () =>
							writeContractAsync(simulation.request),
						),
					);
					await measurePerformance("transaction.receipt", () =>
						waitForTransactionReceipt(wagmiConfig, {
							hash,
							chainId: sepolia.id,
						}),
					);
					setTransactionHash(hash);
					setPhase("success");
					setMessage("兑换已在 Sepolia 确认；测试资产没有真实价值。");
				} catch (error) {
					setPhase("error");
					setMessage(toWalletMessage(error));
					throw error;
				} finally {
					pendingRef.current = false;
				}
			}),
		).catch(() => undefined);
	}, [
		address,
		amountIn,
		asset,
		quotedAmountOut,
		quotedInput,
		selected.address,
		walletState,
		writeContractAsync,
	]);

	return {
		asset,
		setAsset: (value: ExchangeAsset) => {
			setAsset(value);
			setQuotedAmountOut(undefined);
			setQuotedInput(undefined);
			setPhase("idle");
			setMessage(undefined);
		},
		amount,
		setAmount: (value: string) => {
			setAmount(value);
			setQuotedAmountOut(undefined);
			setQuotedInput(undefined);
			setPhase("idle");
			setMessage(undefined);
		},
		configured,
		walletState,
		quotedBaby:
			quotedAmountOut === undefined ? undefined : formattedQuote.display,
		quotedBabyExact: formattedQuote.exact,
		quotedBabyIsApproximate: formattedQuote.isApproximate,
		phase,
		message,
		transactionHash,
		quote,
		execute,
		canQuote: configured && Boolean(amountIn && amountIn > 0n),
		canExecute:
			walletState === "ready" && phase === "quoted" && quotedInput === amountIn,
		switchToSepolia: () => switchChainAsync({ chainId: sepolia.id }),
	};
}
