import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { network } from "hardhat";
import {
	type Address,
	createPublicClient,
	formatUnits,
	getAddress,
	http,
	parseAbi,
	parseUnits,
	zeroAddress,
} from "viem";
import { sepolia } from "viem/chains";

import { encodeSqrtRatioX96, sortPairAmounts } from "./lib/uniswapPoolMath.js";

const FACTORY = getAddress("0x0227628f3F023bb0B980b67D528571c95c6DaC1c");
const POSITION_MANAGER = getAddress(
	"0x1238536071E1c677A632429e3655c799b22cDA52",
);
const OFFICIAL_USDC = getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
const WETH9 = getAddress("0xfff9976782d46cc05630d1f6ebab18b2324d6b14");
const FEE = 3_000;
const FULL_RANGE_LOWER = -887_220;
const FULL_RANGE_UPPER = 887_220;
const DEPLOYMENT_PATH = resolve(
	"ignition/deployments/chain-11155111/deployed_addresses.json",
);
const EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-10-uniswap-v3-pools.json",
);
const BUSINESS_EVIDENCE_PATH = resolve(
	"../docs/evidence/deployment/2026-08-09-business-closed-loop.json",
);
const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

const erc20Abi = parseAbi([
	"function symbol() view returns (string)",
	"function decimals() view returns (uint8)",
	"function balanceOf(address account) view returns (uint256)",
	"function allowance(address owner, address spender) view returns (uint256)",
	"function approve(address spender, uint256 value) returns (bool)",
]);
const factoryAbi = parseAbi([
	"function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
]);
const positionManagerAbi = parseAbi([
	"function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) payable returns (address pool)",
	"function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline) params) payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
]);
const wethAbi = parseAbi(["function deposit() payable"]);

type PairEvidence = {
	name: "BABY/USDC" | "BABY/WETH";
	status: "planned" | "complete";
	pool: Address;
	amounts: Record<string, string>;
	transactions: Record<string, `0x${string}`>;
};

const deployed = JSON.parse(await readFile(DEPLOYMENT_PATH, "utf8")) as Record<
	string,
	Address
>;
const babyCoin = getAddress(
	process.env.UNISWAP_BABY_ADDRESS?.trim() ||
		deployed["BabyStepsWeb3Module#BabyCoin"],
);
const execute = process.env.UNISWAP_EXECUTE === "1";

let fallbackOperator: Address | undefined;
try {
	const previous = JSON.parse(
		await readFile(BUSINESS_EVIDENCE_PATH, "utf8"),
	) as { operator?: Address };
	if (previous.operator) fallbackOperator = getAddress(previous.operator);
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const connection = execute ? await network.create() : undefined;
const [wallet] = connection ? await connection.viem.getWalletClients() : [];
const publicClient = connection
	? await connection.viem.getPublicClient()
	: createPublicClient({ chain: sepolia, transport: http(PUBLIC_RPC) });
if (execute && !wallet) throw new Error("No Sepolia wallet is configured.");
const operator = wallet
	? getAddress(wallet.account.address)
	: getAddress(
			process.env.UNISWAP_OPERATOR?.trim() ||
				fallbackOperator ||
				"0x0000000000000000000000000000000000000001",
		);

function requireWallet() {
	if (!wallet) {
		throw new Error("UNISWAP_EXECUTE=1 requires a configured Sepolia wallet.");
	}
	return wallet;
}

async function assertContract(address: Address, label: string) {
	const code = await publicClient.getCode({ address });
	if (!code || code === "0x")
		throw new Error(`${label} is not deployed on Sepolia.`);
}

async function readToken(address: Address) {
	const [symbol, decimals, balance] = await Promise.all([
		publicClient.readContract({
			address,
			abi: erc20Abi,
			functionName: "symbol",
		}),
		publicClient.readContract({
			address,
			abi: erc20Abi,
			functionName: "decimals",
		}),
		publicClient.readContract({
			address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [operator],
		}),
	]);
	return { symbol, decimals, balance };
}

async function approveExact(token: Address, amount: bigint) {
	const signer = requireWallet();
	const allowance = await publicClient.readContract({
		address: token,
		abi: erc20Abi,
		functionName: "allowance",
		args: [operator, POSITION_MANAGER],
	});
	if (allowance >= amount) return undefined;
	const hash = await signer.writeContract({
		account: signer.account,
		address: token,
		abi: erc20Abi,
		functionName: "approve",
		args: [POSITION_MANAGER, amount],
	});
	await publicClient.waitForTransactionReceipt({ hash });
	return hash;
}

async function provisionPair(input: {
	name: PairEvidence["name"];
	pairToken: Address;
	babyAmount: string;
	pairAmount: string;
}): Promise<PairEvidence> {
	const [baby, pair] = await Promise.all([
		readToken(babyCoin),
		readToken(input.pairToken),
	]);
	const babyDesired = parseUnits(input.babyAmount, baby.decimals);
	const pairDesired = parseUnits(input.pairAmount, pair.decimals);
	const sorted = sortPairAmounts(
		babyCoin,
		input.pairToken,
		babyDesired,
		pairDesired,
	);
	let pool = getAddress(
		await publicClient.readContract({
			address: FACTORY,
			abi: factoryAbi,
			functionName: "getPool",
			args: [sorted.token0, sorted.token1, FEE],
		}),
	);
	const transactions: Record<string, `0x${string}`> = {};

	if (!execute) {
		return {
			name: input.name,
			status: "planned",
			pool,
			amounts: {
				[baby.symbol]: `${input.babyAmount} (balance ${formatUnits(baby.balance, baby.decimals)})`,
				[pair.symbol]: `${input.pairAmount} (balance ${formatUnits(pair.balance, pair.decimals)})`,
			},
			transactions,
		};
	}

	if (baby.balance < babyDesired || pair.balance < pairDesired) {
		throw new Error(
			`${input.name} cannot be funded: operator lacks the configured token amounts.`,
		);
	}
	if (pool === zeroAddress) {
		const signer = requireWallet();
		const hash = await signer.writeContract({
			account: signer.account,
			address: POSITION_MANAGER,
			abi: positionManagerAbi,
			functionName: "createAndInitializePoolIfNecessary",
			args: [
				sorted.token0,
				sorted.token1,
				FEE,
				encodeSqrtRatioX96(sorted.amount1, sorted.amount0),
			],
		});
		await publicClient.waitForTransactionReceipt({ hash });
		transactions.createAndInitialize = hash;
		pool = getAddress(
			await publicClient.readContract({
				address: FACTORY,
				abi: factoryAbi,
				functionName: "getPool",
				args: [sorted.token0, sorted.token1, FEE],
			}),
		);
	}

	const [approve0, approve1] = await Promise.all([
		approveExact(sorted.token0, sorted.amount0),
		approveExact(sorted.token1, sorted.amount1),
	]);
	if (approve0) transactions.approveToken0 = approve0;
	if (approve1) transactions.approveToken1 = approve1;
	const signer = requireWallet();
	const mintHash = await signer.writeContract({
		account: signer.account,
		address: POSITION_MANAGER,
		abi: positionManagerAbi,
		functionName: "mint",
		args: [
			{
				token0: sorted.token0,
				token1: sorted.token1,
				fee: FEE,
				tickLower: FULL_RANGE_LOWER,
				tickUpper: FULL_RANGE_UPPER,
				amount0Desired: sorted.amount0,
				amount1Desired: sorted.amount1,
				amount0Min: (sorted.amount0 * 99n) / 100n,
				amount1Min: (sorted.amount1 * 99n) / 100n,
				recipient: operator,
				deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
			},
		],
	});
	await publicClient.waitForTransactionReceipt({ hash: mintHash });
	transactions.mintLiquidity = mintHash;

	return {
		name: input.name,
		status: "complete",
		pool,
		amounts: {
			[baby.symbol]: input.babyAmount,
			[pair.symbol]: input.pairAmount,
		},
		transactions,
	};
}

await Promise.all([
	assertContract(babyCoin, "BABY"),
	assertContract(OFFICIAL_USDC, "official Sepolia USDC"),
	assertContract(WETH9, "Sepolia WETH9"),
	assertContract(FACTORY, "Uniswap v3 Factory"),
	assertContract(POSITION_MANAGER, "Uniswap v3 Position Manager"),
]);

const pairInputs = [
	{
		name: "BABY/USDC" as const,
		pairToken: OFFICIAL_USDC,
		babyAmount: process.env.UNISWAP_BABY_USDC_AMOUNT?.trim() || "8",
		pairAmount: process.env.UNISWAP_USDC_AMOUNT?.trim() || "8",
	},
	{
		name: "BABY/WETH" as const,
		pairToken: WETH9,
		babyAmount: process.env.UNISWAP_BABY_WETH_AMOUNT?.trim() || "8",
		pairAmount: process.env.UNISWAP_WETH_AMOUNT?.trim() || "0.002",
	},
];

if (execute) {
	const [baby, usdc, weth, nativeBalance] = await Promise.all([
		readToken(babyCoin),
		readToken(OFFICIAL_USDC),
		readToken(WETH9),
		publicClient.getBalance({ address: operator }),
	]);
	const totalBaby = pairInputs.reduce(
		(total, input) => total + parseUnits(input.babyAmount, baby.decimals),
		0n,
	);
	const requiredUsdc = parseUnits(pairInputs[0].pairAmount, usdc.decimals);
	const requiredWeth = parseUnits(pairInputs[1].pairAmount, weth.decimals);
	if (baby.balance < totalBaby) {
		throw new Error("Preflight failed: not enough BABY for both pools.");
	}
	if (usdc.balance < requiredUsdc) {
		throw new Error(
			"Preflight failed: official Sepolia USDC is required before any pool transaction.",
		);
	}
	if (weth.balance < requiredWeth) {
		const deficit = requiredWeth - weth.balance;
		if (nativeBalance <= deficit) {
			throw new Error("Preflight failed: not enough test ETH to wrap WETH.");
		}
		const signer = requireWallet();
		const wrapHash = await signer.writeContract({
			account: signer.account,
			address: WETH9,
			abi: wethAbi,
			functionName: "deposit",
			value: deficit,
		});
		await publicClient.waitForTransactionReceipt({ hash: wrapHash });
	}
}

const pairs = [] as PairEvidence[];
for (const input of pairInputs) {
	pairs.push(await provisionPair(input));
}

const evidence = {
	status: pairs.every((pair) => pair.status === "complete")
		? "complete"
		: "planned",
	updatedAt: new Date().toISOString(),
	network: "Ethereum Sepolia",
	chainId: 11155111,
	operator,
	addresses: {
		babyCoin,
		officialUsdc: OFFICIAL_USDC,
		weth9: WETH9,
		factory: FACTORY,
		positionManager: POSITION_MANAGER,
	},
	fee: FEE,
	pairs,
	limitations:
		"Test assets have no monetary value. Planned mode sends no transaction; UNISWAP_EXECUTE=1 is required to create or fund pools.",
};
await mkdir(dirname(EVIDENCE_PATH), { recursive: true });
await writeFile(
	EVIDENCE_PATH,
	`${JSON.stringify(evidence, null, 2)}\n`,
	"utf8",
);
console.log(
	JSON.stringify({ ...evidence, evidencePath: EVIDENCE_PATH }, null, 2),
);
