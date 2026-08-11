import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, zeroAddress } from "viem";

describe("GrowthCertificateSBT", async () => {
	const { viem } = await network.create();
	const [admin, minter, parent, recipient, operator] =
		await viem.getWalletClients();

	async function deployCertificate() {
		const certificate = await viem.deployContract(
			"GrowthCertificateSBTHarness",
			[admin.account.address],
		);
		const minterRole = await certificate.read.MINTER_ROLE();
		await certificate.write.grantRole([minterRole, minter.account.address], {
			account: admin.account,
		});
		return { certificate, minterRole };
	}

	async function mintCertificate() {
		const deployed = await deployCertificate();
		await deployed.certificate.write.mintForPurchase(
			[parent.account.address, 7n, "ipfs://certificate/7"],
			{ account: minter.account },
		);
		return deployed;
	}

	it("publishes ERC-5192 support and locks each minted certificate", async () => {
		const { certificate } = await mintCertificate();

		assert.equal(
			await certificate.read.supportsInterface(["0xb45a3c0e"]),
			true,
		);
		assert.equal(await certificate.read.locked([1n]), true);
		assert.equal(
			await certificate.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);
		assert.equal(await certificate.read.tokenURI([1n]), "ipfs://certificate/7");
	});

	it("rejects a locked query for a token that does not exist", async () => {
		const { certificate } = await deployCertificate();

		await viem.assertions.revertWithCustomErrorWithArgs(
			certificate.read.locked([99n]),
			certificate,
			"ERC721NonexistentToken",
			[99n],
		);
	});

	it("returns the same token for an identical purchase mint request", async () => {
		const { certificate } = await mintCertificate();

		await certificate.write.mintForPurchase(
			[parent.account.address, 7n, "ipfs://certificate/7"],
			{ account: minter.account },
		);

		assert.equal(await certificate.read.tokenForPurchase([7n]), 1n);
		assert.equal(await certificate.read.nextTokenId(), 2n);
		assert.equal(
			await certificate.read.balanceOf([parent.account.address]),
			1n,
		);
		assert.equal(await certificate.read.tokenURI([1n]), "ipfs://certificate/7");
	});

	it("rejects conflicting recipient or metadata for an existing purchase", async () => {
		const { certificate } = await mintCertificate();

		await viem.assertions.revertWithCustomErrorWithArgs(
			certificate.write.mintForPurchase(
				[recipient.account.address, 7n, "ipfs://certificate/7"],
				{ account: minter.account },
			),
			certificate,
			"CertificateConflict",
			[7n, 1n],
		);
		await viem.assertions.revertWithCustomErrorWithArgs(
			certificate.write.mintForPurchase(
				[parent.account.address, 7n, "ipfs://certificate/changed"],
				{ account: minter.account },
			),
			certificate,
			"CertificateConflict",
			[7n, 1n],
		);
	});

	it("rejects minting by a wallet without the minter role", async () => {
		const { certificate, minterRole } = await deployCertificate();

		await viem.assertions.revertWithCustomErrorWithArgs(
			certificate.write.mintForPurchase(
				[parent.account.address, 7n, "ipfs://certificate/7"],
				{ account: parent.account },
			),
			certificate,
			"AccessControlUnauthorizedAccount",
			[parent.account.address, minterRole],
		);
	});

	it("rejects approvals, transfers, safe transfers, and burns", async () => {
		const { certificate } = await mintCertificate();

		const operations = [
			() =>
				certificate.write.approve([operator.account.address, 1n], {
					account: parent.account,
				}),
			() =>
				certificate.write.setApprovalForAll([operator.account.address, true], {
					account: parent.account,
				}),
			() =>
				certificate.write.transferFrom(
					[parent.account.address, recipient.account.address, 1n],
					{ account: parent.account },
				),
			() =>
				certificate.write.safeTransferFrom(
					[parent.account.address, recipient.account.address, 1n],
					{ account: parent.account },
				),
			() =>
				certificate.write.safeTransferFrom(
					[parent.account.address, recipient.account.address, 1n, "0x"],
					{ account: parent.account },
				),
			() => certificate.write.burnForTest([1n], { account: parent.account }),
		];

		for (const operation of operations) {
			await viem.assertions.revertWithCustomError(
				operation(),
				certificate,
				"Soulbound",
			);
		}
		assert.equal(
			await certificate.read.ownerOf([1n]),
			getAddress(parent.account.address),
		);
		assert.notEqual(await certificate.read.ownerOf([1n]), zeroAddress);
	});
});
