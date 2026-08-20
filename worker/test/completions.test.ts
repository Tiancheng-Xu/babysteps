import { env } from "cloudflare:workers";
import type { PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type {
	BindingInput,
	ChainTaskView,
	MarketplaceReader,
	VerifiedTaskBinding,
} from "../src/chain/marketplaceReader";
import { buildTaskKey, type TaskKey } from "../src/domain/taskIdentity";
import { canonicalizeTaskMetadata } from "../src/domain/taskMetadata";
import { cookieFrom, createChallenge, createSession } from "./helpers/auth";
import { requestFor, type TestRequest } from "./helpers/request";

const marketplace = "0x1234567890abcdef1234567890abcdef12345678" as const;
const taskKey = buildTaskKey(11155111, marketplace, 42n);
const certificateUri =
	"https://babysteps.baby2b.online/metadata/sepolia-demo-certificate.json";

class CompletionMarketplaceReader implements MarketplaceReader {
	purchaseId = 0n;

	async hasProviderRole(): Promise<boolean> {
		return false;
	}
	async verifyTaskBinding(_input: BindingInput): Promise<VerifiedTaskBinding> {
		throw new Error("not used");
	}
	async readTask(_key: TaskKey): Promise<ChainTaskView> {
		throw new Error("not used");
	}
	async purchaseIdForBuyer(): Promise<bigint> {
		return this.purchaseId;
	}
}

let reader: CompletionMarketplaceReader;
let owner: PrivateKeyAccount;
let request: TestRequest;

function account() {
	return privateKeyToAccount(generatePrivateKey());
}

async function login(wallet: PrivateKeyAccount): Promise<string> {
	const challenge = await createChallenge(wallet, "login", request);
	return cookieFrom(await createSession(wallet, challenge, request));
}

beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare("DELETE FROM completion_submissions"),
		env.DB.prepare("DELETE FROM published_tasks"),
		env.DB.prepare("DELETE FROM task_drafts"),
	]);
	const now = Math.floor(Date.now() / 1000);
	const draftId = crypto.randomUUID();
	const metadata = canonicalizeTaskMetadata({
		title: "Bedtime Story",
		description: "Read one picture book together before sleep.",
		coverUrl: "https://cdn.baby2b.online/tasks/read-cover.webp",
		videoUrl: "https://cdn.baby2b.online/tasks/read-guide.mp4",
		completionInstructions: "Finish the story and confirm completion.",
		activityType: "Read",
	});
	await env.DB.batch([
		env.DB.prepare(
			`INSERT INTO task_drafts
			(id, provider_wallet, metadata_json, metadata_hash, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
		).bind(
			draftId,
			"0x0000000000000000000000000000000000000001",
			metadata.canonicalJson,
			metadata.metadataHash,
			now,
			now,
		),
		env.DB.prepare(
			`INSERT INTO published_tasks
			(task_key, draft_id, chain_id, marketplace_address, task_id, transaction_hash, metadata_hash, created_at)
			VALUES (?, ?, ?, ?, '42', ?, ?, ?)`,
		).bind(
			taskKey,
			draftId,
			11155111,
			marketplace,
			`0x${"ab".repeat(32)}`,
			metadata.metadataHash,
			now,
		),
	]);
	reader = new CompletionMarketplaceReader();
	owner = account();
	request = requestFor(
		createApp({
			marketplaceReaderFactory: () => reader,
			ownerWalletFactory: () => owner.address.toLowerCase(),
		}),
	);
});

describe("completion submissions", () => {
	it("requires a signed-in on-chain buyer", async () => {
		const unauthenticated = await request(`/api/tasks/${taskKey}/completions`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ evidence: "已完成亲子共读。", certificateUri }),
		});
		expect(unauthenticated.status).toBe(401);

		const cookie = await login(account());
		const notPurchased = await request(`/api/tasks/${taskKey}/completions`, {
			method: "POST",
			headers: { "content-type": "application/json", cookie },
			body: JSON.stringify({ evidence: "已完成亲子共读。", certificateUri }),
		});
		expect(notPurchased.status).toBe(403);
	});

	it("creates an idempotent hashed submission and rejects evidence conflicts", async () => {
		const buyer = account();
		const cookie = await login(buyer);
		reader.purchaseId = 9n;
		const submit = (evidence: string) =>
			request(`/api/tasks/${taskKey}/completions`, {
				method: "POST",
				headers: { "content-type": "application/json", cookie },
				body: JSON.stringify({ evidence, certificateUri }),
			});

		const created = await submit(" 已完成亲子共读，并按说明确认。 ");
		expect(created.status).toBe(201);
		const payload = await created.json<{
			id: string;
			purchaseId: string;
			evidenceHash: string;
			created: boolean;
		}>();
		expect(payload).toMatchObject({ purchaseId: "9", created: true });
		expect(payload.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/u);

		const retry = await submit("已完成亲子共读，并按说明确认。");
		expect(retry.status).toBe(200);
		await expect(retry.json()).resolves.toMatchObject({
			id: payload.id,
			created: false,
		});

		const conflict = await submit("换一份不同的完成证据。");
		expect(conflict.status).toBe(409);
		await expect(conflict.json()).resolves.toMatchObject({
			error: { code: "COMPLETION_EVIDENCE_CONFLICT" },
		});
	});

	it("rejects unsafe or oversized evidence", async () => {
		const cookie = await login(account());
		reader.purchaseId = 9n;
		for (const evidence of ["x", "儿童姓名：小明\u0000", "字".repeat(281)]) {
			const response = await request(`/api/tasks/${taskKey}/completions`, {
				method: "POST",
				headers: { "content-type": "application/json", cookie },
				body: JSON.stringify({ evidence, certificateUri }),
			});
			expect(response.status).toBe(400);
		}
	});

	it("allows only the configured Owner to list review records", async () => {
		const buyer = account();
		const buyerCookie = await login(buyer);
		reader.purchaseId = 9n;
		await request(`/api/tasks/${taskKey}/completions`, {
			method: "POST",
			headers: { "content-type": "application/json", cookie: buyerCookie },
			body: JSON.stringify({ evidence: "已完成亲子共读。", certificateUri }),
		});

		const forbidden = await request("/api/completions", {
			headers: { cookie: buyerCookie },
		});
		expect(forbidden.status).toBe(403);

		const ownerCookie = await login(owner);
		const list = await request("/api/completions", {
			headers: { cookie: ownerCookie },
		});
		expect(list.status).toBe(200);
		await expect(list.json()).resolves.toMatchObject({
			completions: [
				{
					taskKey,
					purchaseId: "9",
					buyerWallet: buyer.address.toLowerCase(),
					evidence: "已完成亲子共读。",
					certificateUri,
				},
			],
		});
	});
});
