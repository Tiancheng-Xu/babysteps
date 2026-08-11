import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const metadataPath = "web/public/metadata/sepolia-demo-certificate.json";
const imagePath = "web/public/media/starbuddy-certificate.jpg";

test("public Sepolia SBT metadata exposes a stable name and image", async () => {
	const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
	const image = await stat(imagePath);

	assert.equal(metadata.name, "StarBuddy 亲子共读成长证书");
	assert.match(metadata.description, /ERC-5192/u);
	assert.equal(
		metadata.image,
		"https://babysteps.baby2b.online/media/starbuddy-certificate.jpg",
	);
	assert.equal(metadata.properties.standard, "ERC-721 + ERC-5192");
	assert.ok(image.size > 1_000, "certificate image must be a non-empty asset");
});
