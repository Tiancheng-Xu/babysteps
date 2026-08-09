import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

describe("GrowthCertificate", async () => {
	const { viem } = await network.create();
	const [admin, minter, parent, recipient] = await viem.getWalletClients();

	async function deployCertificate() {
		const certificate = await viem.deployContract("GrowthCertificate", [
			admin.account.address,
		]);
		const minterRole = await certificate.read.MINTER_ROLE();
		await certificate.write.grantRole([minterRole, minter.account.address], {
			account: admin.account,
		});
		return { certificate, minterRole };
	}

	it("mints one certificate with metadata for a purchase", async () => {
		const { certificate } = await deployCertificate();
		const tokenId = (await certificate.read.nextTokenId()) as bigint;

		await certificate.write.mintForPurchase(
			[parent.account.address, 7n, "ipfs://certificate/7"],
			{ account: minter.account },
		);

		assert.equal(await certificate.read.name(), "BabySteps Growth Certificate");
		assert.equal(await certificate.read.symbol(), "BABY-CERT");
		assert.equal(
			await certificate.read.ownerOf([tokenId]),
			getAddress(parent.account.address),
		);
		assert.equal(
			await certificate.read.tokenURI([tokenId]),
			"ipfs://certificate/7",
		);
		assert.equal(await certificate.read.tokenForPurchase([7n]), tokenId);
		assert.equal(await certificate.read.nextTokenId(), tokenId + 1n);
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

	it("rejects a second certificate for the same purchase", async () => {
		const { certificate } = await deployCertificate();
		await certificate.write.mintForPurchase(
			[parent.account.address, 7n, "ipfs://certificate/7"],
			{ account: minter.account },
		);

		await viem.assertions.revertWithCustomErrorWithArgs(
			certificate.write.mintForPurchase(
				[parent.account.address, 7n, "ipfs://certificate/7-again"],
				{ account: minter.account },
			),
			certificate,
			"CertificateAlreadyMinted",
			[7n, 1n],
		);
	});

	it("supports standard ERC-721 transfers", async () => {
		const { certificate } = await deployCertificate();
		await certificate.write.mintForPurchase(
			[parent.account.address, 7n, "ipfs://certificate/7"],
			{ account: minter.account },
		);

		await certificate.write.transferFrom(
			[parent.account.address, recipient.account.address, 1n],
			{ account: parent.account },
		);

		assert.equal(
			await certificate.read.ownerOf([1n]),
			getAddress(recipient.account.address),
		);
		assert.equal(await certificate.read.tokenForPurchase([7n]), 1n);
	});
});
