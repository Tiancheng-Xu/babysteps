import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

describe("StarBuddyKeepsakeSBT", async () => {
	const { viem } = await network.create();
	const [admin, coordinator, parent, recipient, operator] =
		await viem.getWalletClients();

	async function deployKeepsake() {
		const keepsake = await viem.deployContract("StarBuddyKeepsakeSBT", [
			admin.account.address,
			"https://babysteps.baby2b.online/metadata/keepsakes/",
		]);
		const minterRole = await keepsake.read.MINTER_ROLE();
		const burnerRole = await keepsake.read.BURNER_ROLE();
		await keepsake.write.grantRole([minterRole, coordinator.account.address], {
			account: admin.account,
		});
		await keepsake.write.grantRole([burnerRole, coordinator.account.address], {
			account: admin.account,
		});
		return { keepsake, minterRole, burnerRole };
	}

	it("mints locked keepsakes with deterministic metadata and traits", async () => {
		const { keepsake } = await deployKeepsake();

		await viem.assertions.emitWithArgs(
			keepsake.write.mint([parent.account.address, 0, 2], {
				account: coordinator.account,
			}),
			keepsake,
			"KeepsakeMinted",
			[1n, parent.account.address, 0, 2],
		);

		assert.equal(
			await keepsake.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);
		assert.deepEqual(await keepsake.read.getKeepsake([1n]), [0, 2]);
		assert.equal(await keepsake.read.locked([1n]), true);
		assert.equal(
			await keepsake.read.tokenURI([1n]),
			"https://babysteps.baby2b.online/metadata/keepsakes/0-2.json",
		);
		assert.deepEqual(
			await keepsake.read.tokensOfOwner([parent.account.address]),
			[1n],
		);
	});

	it("enumerates each wallet's keepsakes after minting and burning", async () => {
		const { keepsake } = await deployKeepsake();
		await keepsake.write.mint([parent.account.address, 0, 0], {
			account: coordinator.account,
		});
		await keepsake.write.mint([recipient.account.address, 1, 1], {
			account: coordinator.account,
		});
		await keepsake.write.mint([parent.account.address, 2, 2], {
			account: coordinator.account,
		});

		assert.deepEqual(
			await keepsake.read.tokensOfOwner([parent.account.address]),
			[1n, 3n],
		);
		assert.deepEqual(
			await keepsake.read.tokensOfOwner([recipient.account.address]),
			[2n],
		);

		await keepsake.write.burnFrom([parent.account.address, 1n], {
			account: coordinator.account,
		});
		assert.deepEqual(
			await keepsake.read.tokensOfOwner([parent.account.address]),
			[3n],
		);
	});

	it("rejects invalid series and rarity values", async () => {
		const { keepsake } = await deployKeepsake();

		await viem.assertions.revertWithCustomErrorWithArgs(
			keepsake.write.mint([parent.account.address, 4, 0], {
				account: coordinator.account,
			}),
			keepsake,
			"InvalidKeepsakeSeries",
			[4],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			keepsake.write.mint([parent.account.address, 0, 4], {
				account: coordinator.account,
			}),
			keepsake,
			"InvalidKeepsakeRarity",
			[4],
		);
	});

	it("requires explicit roles for minting and burning", async () => {
		const { keepsake, minterRole, burnerRole } = await deployKeepsake();

		await viem.assertions.revertWithCustomErrorWithArgs(
			keepsake.write.mint([parent.account.address, 0, 0], {
				account: operator.account,
			}),
			keepsake,
			"AccessControlUnauthorizedAccount",
			[operator.account.address, minterRole],
		);
		await keepsake.write.mint([parent.account.address, 0, 0], {
			account: coordinator.account,
		});
		await viem.assertions.revertWithCustomErrorWithArgs(
			keepsake.write.burnFrom([parent.account.address, 1n], {
				account: operator.account,
			}),
			keepsake,
			"AccessControlUnauthorizedAccount",
			[operator.account.address, burnerRole],
		);
	});

	it("only burns tokens that belong to the supplied wallet", async () => {
		const { keepsake } = await deployKeepsake();
		await keepsake.write.mint([parent.account.address, 3, 3], {
			account: coordinator.account,
		});

		await viem.assertions.revertWithCustomErrorWithArgs(
			keepsake.write.burnFrom([recipient.account.address, 1n], {
				account: coordinator.account,
			}),
			keepsake,
			"KeepsakeOwnerMismatch",
			[1n, recipient.account.address, parent.account.address],
		);
	});

	it("rejects every approval and transfer path", async () => {
		const { keepsake } = await deployKeepsake();
		await keepsake.write.mint([parent.account.address, 0, 0], {
			account: coordinator.account,
		});

		const operations = [
			() =>
				keepsake.write.approve([operator.account.address, 1n], {
					account: parent.account,
				}),
			() =>
				keepsake.write.setApprovalForAll([operator.account.address, true], {
					account: parent.account,
				}),
			() =>
				keepsake.write.transferFrom(
					[parent.account.address, recipient.account.address, 1n],
					{ account: parent.account },
				),
			() =>
				keepsake.write.safeTransferFrom(
					[parent.account.address, recipient.account.address, 1n],
					{ account: parent.account },
				),
		];
		for (const operation of operations) {
			await viem.assertions.revertWithCustomError(
				operation(),
				keepsake,
				"Soulbound",
			);
		}
	});
});
