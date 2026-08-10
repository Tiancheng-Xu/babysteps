import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requiredHeaders = [
	"作业要求",
	"实现功能",
	"代码位置",
	"验证证据",
	"当前状态",
];
const allowedStatuses = new Set(["complete", "partial", "pending", "blocked"]);
const architectureSections = [
	"运行时请求与数据流",
	"部署与 CI/CD",
	"权限与安全边界",
];
const architectureMarkers = ["现有", "计划", "待验证"];
const workerEvidenceMarkers = [
	"chainId:marketplaceAddress:taskId",
	"nonce",
	"D1 migrations",
	"purchaseIdForBuyer",
	"local only",
	"no remote D1 or Worker deployment",
];

function tableCells(line) {
	if (!line.trim().startsWith("|")) return [];
	return line
		.trim()
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

function normalizeStatus(value) {
	return value.replaceAll("`", "").trim().toLowerCase();
}

export function validateHomeworkEvidence(
	mapText,
	architectureText,
	workerEvidenceText,
) {
	const errors = [];
	const lines = mapText.split(/\r?\n/);
	const headerLineIndex = lines.findIndex((line) => {
		const cells = tableCells(line);
		return cells.includes("作业要求") && cells.includes("当前状态");
	});

	if (headerLineIndex < 0) {
		errors.push("implementation map is missing its requirements table");
	} else {
		const headers = tableCells(lines[headerLineIndex]);
		for (const header of requiredHeaders) {
			if (!headers.includes(header))
				errors.push(`implementation map is missing column: ${header}`);
		}

		const statusIndex = headers.indexOf("当前状态");
		if (statusIndex >= 0) {
			for (const line of lines.slice(headerLineIndex + 2)) {
				const cells = tableCells(line);
				if (cells.length === 0) break;
				if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
				const status = normalizeStatus(cells[statusIndex] ?? "");
				if (!allowedStatuses.has(status)) {
					errors.push(`invalid status: ${status || "empty"}`);
				}
			}
		}
	}

	for (const section of architectureSections) {
		if (!architectureText.includes(section)) {
			errors.push(`architecture is missing section: ${section}`);
		}
	}
	for (const marker of architectureMarkers) {
		if (!architectureText.includes(marker)) {
			errors.push(`architecture is missing status marker: ${marker}`);
		}
	}
	if (!architectureText.includes("Worker/D1 本地已验证")) {
		errors.push("architecture must mark Worker/D1 本地已验证");
	}
	if (!workerEvidenceText) {
		errors.push("Phase 2 evidence is missing");
	} else {
		for (const marker of workerEvidenceMarkers) {
			if (!workerEvidenceText.includes(marker)) {
				errors.push(`Phase 2 evidence is missing marker: ${marker}`);
			}
		}
	}

	return errors;
}

async function main() {
	const mapPath =
		process.argv[2] ?? "docs/homework/web3-homework-implementation-map.md";
	const architecturePath =
		process.argv[3] ?? "docs/architecture/starbuddy-web3-architecture.mmd";
	const workerEvidencePath =
		process.argv[4] ?? "docs/evidence/testing/2026-08-10-worker-d1.md";
	const [mapText, architectureText, workerEvidenceText] = await Promise.all([
		readFile(mapPath, "utf8"),
		readFile(architecturePath, "utf8"),
		readFile(workerEvidencePath, "utf8"),
	]);
	const errors = validateHomeworkEvidence(
		mapText,
		architectureText,
		workerEvidenceText,
	);
	if (errors.length > 0) {
		for (const error of errors) console.error(error);
		process.exitCode = 1;
		return;
	}
	console.log("homework evidence contract: ok");
}

const executedPath = process.argv[1]
	? pathToFileURL(resolve(process.argv[1])).href
	: "";
if (import.meta.url === executedPath) await main();
