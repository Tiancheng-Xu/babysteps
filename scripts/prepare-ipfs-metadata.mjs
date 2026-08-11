import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
import * as raw from "multiformats/codecs/raw";

const ARCHITECTURE_IMAGE = resolve(
	"docs/architecture/starbuddy-web3-architecture-v2.png",
);
const TASK_OUTPUT = resolve("web/public/metadata/ipfs/starbuddy-task.json");
const CERTIFICATE_OUTPUT = resolve(
	"web/public/metadata/ipfs/starbuddy-certificate.json",
);
const MANIFEST_OUTPUT = resolve(
	"docs/evidence/deployment/2026-08-10-ipfs-metadata-manifest.json",
);

export async function rawCid(bytes) {
	return CID.createV1(raw.code, await sha256.digest(bytes)).toString();
}

export function buildTaskMetadata(imageCid) {
	return {
		name: "StarBuddy 亲子共读成长任务",
		description:
			"BabySteps Sepolia 成长任务：由学习机构或育婴师提交，Owner 审核后通过 Chainlink VRF 随机确定 BABY 价格和开放时长。",
		image: `ipfs://${imageCid}`,
		external_url: "https://babysteps.baby2b.online/",
		attributes: [
			{ trait_type: "Activity", value: "Read" },
			{ trait_type: "Network", value: "Ethereum Sepolia" },
			{ trait_type: "Review", value: "Owner approved" },
		],
		properties: {
			schema: "babysteps.task.v1",
			childPersonalData: "excluded",
			videoAndComments: "stored offchain in D1",
		},
	};
}

export function buildCertificateMetadata(imageCid) {
	return {
		name: "StarBuddy 亲子共读成长证书",
		description:
			"完成 BabySteps 成长任务后铸造的 Sepolia 灵魂绑定证书；不可批准、转让或销毁。",
		image: `ipfs://${imageCid}`,
		external_url: "https://babysteps.baby2b.online/",
		attributes: [
			{ trait_type: "Activity", value: "Read" },
			{ trait_type: "Companion", value: "StarBuddy" },
			{ trait_type: "Network", value: "Ethereum Sepolia" },
			{ trait_type: "Transferability", value: "Locked" },
		],
		properties: {
			schema: "babysteps.certificate.v1",
			standard: "ERC-721 + ERC-5192",
			idempotencyKey: "purchaseId",
			childPersonalData: "excluded",
		},
	};
}

function stableJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export async function prepareIpfsMetadata() {
	const imageBytes = await readFile(ARCHITECTURE_IMAGE);
	const imageCid = await rawCid(imageBytes);
	const taskBytes = new TextEncoder().encode(
		stableJson(buildTaskMetadata(imageCid)),
	);
	const certificateBytes = new TextEncoder().encode(
		stableJson(buildCertificateMetadata(imageCid)),
	);
	const [taskCid, certificateCid] = await Promise.all([
		rawCid(taskBytes),
		rawCid(certificateBytes),
	]);

	await Promise.all([
		mkdir(dirname(TASK_OUTPUT), { recursive: true }),
		mkdir(dirname(MANIFEST_OUTPUT), { recursive: true }),
	]);
	await Promise.all([
		writeFile(TASK_OUTPUT, taskBytes),
		writeFile(CERTIFICATE_OUTPUT, certificateBytes),
	]);
	const manifest = {
		status: "prepared-not-pinned",
		generatedAt: new Date().toISOString(),
		codec: "raw",
		files: {
			image: {
				cid: imageCid,
				uri: `ipfs://${imageCid}`,
				source: "docs/architecture/starbuddy-web3-architecture-v2.png",
			},
			task: {
				cid: taskCid,
				uri: `ipfs://${taskCid}`,
				source: "web/public/metadata/ipfs/starbuddy-task.json",
			},
			certificate: {
				cid: certificateCid,
				uri: `ipfs://${certificateCid}`,
				source: "web/public/metadata/ipfs/starbuddy-certificate.json",
			},
		},
		verification:
			"CIDs are deterministic for the exact bytes. Availability remains pending until all three files are pinned and fetched through an independent gateway.",
	};
	await writeFile(MANIFEST_OUTPUT, stableJson(manifest));
	return manifest;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	console.log(JSON.stringify(await prepareIpfsMetadata(), null, 2));
}
