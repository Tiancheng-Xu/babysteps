import assert from "node:assert/strict";
import { test } from "node:test";

import {
	buildCertificateMetadata,
	buildTaskMetadata,
	rawCid,
} from "./prepare-ipfs-metadata.mjs";

test("IPFS metadata uses content-addressed image references", async () => {
	const imageCid = await rawCid(new TextEncoder().encode("starbuddy-image"));
	const certificate = buildCertificateMetadata(imageCid);
	const task = buildTaskMetadata(imageCid);

	assert.match(certificate.image, /^ipfs:\/\/b/u);
	assert.equal(certificate.properties.standard, "ERC-721 + ERC-5192");
	assert.equal(task.image, certificate.image);
	assert.equal(task.properties.childPersonalData, "excluded");
});

test("raw CID is deterministic for the exact public bytes", async () => {
	const bytes = new TextEncoder().encode('{"name":"StarBuddy"}\n');
	assert.equal(await rawCid(bytes), await rawCid(bytes));
	assert.notEqual(
		await rawCid(bytes),
		await rawCid(new TextEncoder().encode('{"name":"StarBuddy"}')),
	);
});
