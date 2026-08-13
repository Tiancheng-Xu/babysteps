import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

const zeroKeyHash = `0x${"00".repeat(32)}` as `0x${string}`;

type RequestView = {
	owner: `0x${string}`;
	kind: number;
	status: number;
	requestedAt: bigint;
	tokenIds: readonly [bigint, bigint, bigint];
	resultTokenId: bigint;
	burnedTokenId: bigint;
};

describe("StarBuddyKeepsakes", async () => {
	const { viem, networkHelpers } = await network.create();
	const [admin, parent, outsider] = await viem.getWalletClients();

	async function deploySystem() {
		const stars = await viem.deployContract("MockTransferableGrowthStars");
		const token = await viem.deployContract("StarBuddyKeepsakeSBT", [
			admin.account.address,
			"https://babysteps.baby2b.online/metadata/keepsakes/",
		]);
		const vrf = await viem.deployContract("MockVrfCoordinator");
		const keepsakes = await viem.deployContract("StarBuddyKeepsakes", [
			stars.address,
			token.address,
			vrf.address,
			1n,
			zeroKeyHash,
			3,
			500_000,
		]);
		const minterRole = await token.read.MINTER_ROLE();
		const burnerRole = await token.read.BURNER_ROLE();
		for (const account of [admin.account.address, keepsakes.address]) {
			await token.write.grantRole([minterRole, account], {
				account: admin.account,
			});
			await token.write.grantRole([burnerRole, account], {
				account: admin.account,
			});
		}
		return { stars, token, vrf, keepsakes };
	}

	async function requestDraw(system: Awaited<ReturnType<typeof deploySystem>>) {
		await system.stars.write.setBalance([parent.account.address, 24n]);
		await system.keepsakes.write.requestDraw([], { account: parent.account });
		return system.vrf.read.latestRequestId();
	}

	async function mintThree(
		system: Awaited<ReturnType<typeof deploySystem>>,
		series: number,
		rarity: number,
	) {
		const tokenIds: [bigint, bigint, bigint] = [1n, 2n, 3n];
		for (const tokenId of tokenIds) {
			assert.equal(await system.token.read.nextTokenId(), tokenId);
			await system.token.write.mint([parent.account.address, series, rarity], {
				account: admin.account,
			});
		}
		return tokenIds;
	}

	it("debits exactly 12 transferable stars and mints an independently randomized keepsake", async () => {
		const system = await deploySystem();
		const requestId = await requestDraw(system);

		assert.equal(
			await system.stars.read.balances([parent.account.address]),
			12n,
		);
		assert.equal(
			await system.keepsakes.read.latestRequestIdByOwner([
				parent.account.address,
			]),
			requestId,
		);
		let request = (await system.keepsakes.read.getRequest([
			requestId,
		])) as RequestView;
		assert.equal(request.kind, 1);
		assert.equal(request.status, 1);

		await system.vrf.write.fulfill([requestId, [3n, 9_200n]]);

		request = (await system.keepsakes.read.getRequest([
			requestId,
		])) as RequestView;
		assert.equal(request.status, 2);
		assert.equal(request.resultTokenId, 1n);
		assert.deepEqual(await system.token.read.getKeepsake([1n]), [3, 2]);
		assert.equal(
			await system.token.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);
	});

	it("implements the 70/22/7/1 draw rarity boundaries", async () => {
		const cases = [
			[6_999n, 0],
			[7_000n, 1],
			[9_199n, 1],
			[9_200n, 2],
			[9_899n, 2],
			[9_900n, 3],
		] as const;

		for (const [rarityWord, expectedRarity] of cases) {
			const system = await deploySystem();
			const requestId = await requestDraw(system);
			await system.vrf.write.fulfill([requestId, [9n, rarityWord]]);
			assert.deepEqual(await system.token.read.getKeepsake([1n]), [
				1,
				expectedRarity,
			]);
		}
	});

	it("locks only three unique matching non-collector cards for fusion", async () => {
		const system = await deploySystem();
		const tokenIds = await mintThree(system, 2, 1);
		await system.keepsakes.write.requestFusion([tokenIds], {
			account: parent.account,
		});

		for (const tokenId of tokenIds) {
			assert.equal(await system.keepsakes.read.isTokenLocked([tokenId]), true);
		}

		await viem.assertions.revertWithCustomError(
			system.keepsakes.write.requestFusion([[1n, 1n, 2n]], {
				account: parent.account,
			}),
			system.keepsakes,
			"DuplicateKeepsake",
		);
		await viem.assertions.revertWithCustomError(
			system.keepsakes.write.requestFusion([[1n, 2n, 3n]], {
				account: outsider.account,
			}),
			system.keepsakes,
			"KeepsakeNotOwned",
		);

		const collectorSystem = await deploySystem();
		const collectorIds = await mintThree(collectorSystem, 0, 3);
		await viem.assertions.revertWithCustomError(
			collectorSystem.keepsakes.write.requestFusion([collectorIds], {
				account: parent.account,
			}),
			collectorSystem.keepsakes,
			"CollectorCannotFuse",
		);
	});

	it("always upgrades three Common cards and burns all parents", async () => {
		const system = await deploySystem();
		const tokenIds = await mintThree(system, 0, 0);
		await system.keepsakes.write.requestFusion([tokenIds], {
			account: parent.account,
		});
		const requestId = await system.vrf.read.latestRequestId();

		await system.vrf.write.fulfill([requestId, [9_999n, 2n]]);

		const request = (await system.keepsakes.read.getRequest([
			requestId,
		])) as RequestView;
		assert.equal(request.status, 2);
		assert.equal(request.resultTokenId, 4n);
		assert.deepEqual(
			await system.token.read.tokensOfOwner([parent.account.address]),
			[4n],
		);
		assert.deepEqual(await system.token.read.getKeepsake([4n]), [0, 1]);
	});

	it("applies the 70% Rare and 40% Star fusion boundaries", async () => {
		const cases = [
			{ rarity: 1, word: 6_999n, succeeds: true },
			{ rarity: 1, word: 7_000n, succeeds: false },
			{ rarity: 2, word: 3_999n, succeeds: true },
			{ rarity: 2, word: 4_000n, succeeds: false },
		] as const;

		for (const testCase of cases) {
			const system = await deploySystem();
			const tokenIds = await mintThree(system, 1, testCase.rarity);
			await system.keepsakes.write.requestFusion([tokenIds], {
				account: parent.account,
			});
			const requestId = await system.vrf.read.latestRequestId();
			await system.vrf.write.fulfill([requestId, [testCase.word, 0n]]);

			const request = (await system.keepsakes.read.getRequest([
				requestId,
			])) as RequestView;
			assert.equal(request.status, testCase.succeeds ? 2 : 3);
			assert.equal(
				(
					(await system.token.read.tokensOfOwner([
						parent.account.address,
					])) as readonly bigint[]
				).length,
				testCase.succeeds ? 1 : 2,
			);
		}
	});

	it("uses the second VRF word to select the failed fusion parent", async () => {
		const system = await deploySystem();
		const tokenIds = await mintThree(system, 1, 1);
		await system.keepsakes.write.requestFusion([tokenIds], {
			account: parent.account,
		});
		const requestId = await system.vrf.read.latestRequestId();

		await system.vrf.write.fulfill([requestId, [7_000n, 4n]]);

		const request = (await system.keepsakes.read.getRequest([
			requestId,
		])) as RequestView;
		assert.equal(request.status, 3);
		assert.equal(request.burnedTokenId, 2n);
		assert.deepEqual(
			await system.token.read.tokensOfOwner([parent.account.address]),
			[1n, 3n],
		);
		assert.equal(await system.keepsakes.read.isTokenLocked([1n]), false);
		assert.equal(await system.keepsakes.read.isTokenLocked([3n]), false);
	});

	it("refunds a draw after 24 hours and ignores a late callback", async () => {
		const system = await deploySystem();
		const requestId = await requestDraw(system);

		await viem.assertions.revertWithCustomError(
			system.keepsakes.write.recover([requestId], { account: parent.account }),
			system.keepsakes,
			"RecoveryNotReady",
		);
		await networkHelpers.time.increase(24 * 60 * 60);
		await system.keepsakes.write.recover([requestId], {
			account: parent.account,
		});

		assert.equal(
			await system.stars.read.balances([parent.account.address]),
			24n,
		);
		assert.equal(
			((await system.keepsakes.read.getRequest([requestId])) as RequestView)
				.status,
			4,
		);
		await system.vrf.write.fulfill([requestId, [0n, 0n]]);
		assert.equal(
			await system.token.read.balanceOf([parent.account.address]),
			0n,
		);
	});

	it("unlocks every fusion parent after 24 hours and ignores a late callback", async () => {
		const system = await deploySystem();
		const tokenIds = await mintThree(system, 2, 2);
		await system.keepsakes.write.requestFusion([tokenIds], {
			account: parent.account,
		});
		const requestId = await system.vrf.read.latestRequestId();

		await networkHelpers.time.increase(24 * 60 * 60);
		await system.keepsakes.write.recover([requestId], {
			account: parent.account,
		});
		for (const tokenId of tokenIds) {
			assert.equal(await system.keepsakes.read.isTokenLocked([tokenId]), false);
		}

		await system.vrf.write.fulfill([requestId, [0n, 0n]]);
		assert.deepEqual(
			await system.token.read.tokensOfOwner([parent.account.address]),
			tokenIds,
		);
	});
});
