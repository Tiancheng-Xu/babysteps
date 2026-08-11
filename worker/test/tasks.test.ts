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
import { buildTaskKey } from "../src/domain/taskIdentity";
import { canonicalizeTaskMetadata } from "../src/domain/taskMetadata";
import { cookieFrom, createChallenge, createSession } from "./helpers/auth";
import { requestFor, type TestRequest } from "./helpers/request";

const marketplace = "0x1234567890abcdef1234567890abcdef12345678" as const;
const transactionHash = `0x${"ab".repeat(32)}` as const;
const payee = "0x9876543210abcdef1234567890abcdef12345678" as const;
const metadata = {
	title: "Bedtime Story",
	description: "Read one picture book together before sleep.",
	coverUrl: "https://cdn.baby2b.online/tasks/read-cover.webp",
	videoUrl: "https://cdn.baby2b.online/tasks/read-guide.mp4",
	completionInstructions: "Finish the story and confirm completion.",
	activityType: "Read" as const,
};

class FakeMarketplaceReader implements MarketplaceReader {
	hasRole = true;
	verificationError: Error | null = null;
	metadataHashOverride: `0x${string}` | null = null;
	lastBindingInput: BindingInput | null = null;
	provider = "0x0000000000000000000000000000000000000000" as `0x${string}`;

	async hasProviderRole(): Promise<boolean> {
		return this.hasRole;
	}

	async verifyTaskBinding(input: BindingInput): Promise<VerifiedTaskBinding> {
		this.lastBindingInput = input;
		if (this.verificationError) {
			throw this.verificationError;
		}
		return {
			transactionHash: input.transactionHash,
			task: this.taskView(
				buildTaskKey(input.chainId, input.marketplaceAddress, input.taskId),
				this.metadataHashOverride ?? input.expectedMetadataHash,
			),
		};
	}

	async readTask(
		taskKey: ReturnType<typeof buildTaskKey>,
	): Promise<ChainTaskView> {
		return this.taskView(
			taskKey,
			canonicalizeTaskMetadata(metadata).metadataHash,
		);
	}

	async purchaseIdForBuyer(): Promise<bigint> {
		return 0n;
	}

	private taskView(
		taskKey: ReturnType<typeof buildTaskKey>,
		metadataHash: `0x${string}`,
	): ChainTaskView {
		const [, address, taskId] = taskKey.split(":");
		return {
			taskKey,
			chainId: 11155111,
			marketplaceAddress: address as `0x${string}`,
			taskId: BigInt(taskId),
			provider: this.provider,
			payee,
			activityType: "Read",
			metadataUri: "https://babysteps.baby2b.online/metadata/task-42.json",
			metadataHash,
			status: "PendingReview",
			paused: false,
			priceWei: 0n,
			opensAt: 0n,
			closesAt: 0n,
		};
	}
}

let reader: FakeMarketplaceReader;
let request: TestRequest;

function account() {
	return privateKeyToAccount(generatePrivateKey());
}

async function login(wallet: PrivateKeyAccount): Promise<string> {
	const challenge = await createChallenge(wallet, "login", request);
	return cookieFrom(await createSession(wallet, challenge, request));
}

async function createDraft(cookie: string, input = metadata) {
	return request("/api/task-drafts", {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify(input),
	});
}

async function bindDraft(
	cookie: string,
	draftId: string,
	hash = transactionHash,
) {
	return request(`/api/task-drafts/${draftId}/bind`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({
			chainId: 11155111,
			marketplaceAddress: marketplace,
			taskId: "42",
			transactionHash: hash,
		}),
	});
}

beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare("DELETE FROM audit_logs WHERE resource_type = 'task-draft'"),
		env.DB.prepare("DELETE FROM comments"),
		env.DB.prepare("DELETE FROM published_tasks"),
		env.DB.prepare("DELETE FROM task_drafts"),
	]);
	reader = new FakeMarketplaceReader();
	request = requestFor(createApp({ marketplaceReaderFactory: () => reader }));
});

describe("task drafts and verified chain binding", () => {
	it("requires a signed-in Provider for draft creation", async () => {
		const unauthenticated = await createDraft("");
		expect(unauthenticated.status).toBe(401);

		const provider = account();
		const cookie = await login(provider);
		reader.hasRole = false;
		const forbidden = await createDraft(cookie);
		expect(forbidden.status).toBe(403);
		await expect(forbidden.json()).resolves.toMatchObject({
			error: { code: "PROVIDER_ROLE_REQUIRED" },
		});
	});

	it("creates and updates only the Provider's unbound draft", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const created = await createDraft(cookie);
		expect(created.status).toBe(201);
		const draft = await created.json<{
			draftId: string;
			metadataHash: string;
		}>();
		expect(draft.metadataHash).toBe(
			canonicalizeTaskMetadata(metadata).metadataHash,
		);

		const other = account();
		const otherCookie = await login(other);
		const forbidden = await request(`/api/task-drafts/${draft.draftId}`, {
			method: "PUT",
			headers: { "content-type": "application/json", cookie: otherCookie },
			body: JSON.stringify({ ...metadata, title: "Changed by another wallet" }),
		});
		expect(forbidden.status).toBe(403);

		const updated = await request(`/api/task-drafts/${draft.draftId}`, {
			method: "PUT",
			headers: { "content-type": "application/json", cookie },
			body: JSON.stringify({ ...metadata, title: "Updated Bedtime Story" }),
		});
		expect(updated.status).toBe(200);
		await expect(updated.json()).resolves.toMatchObject({
			metadata: { title: "Updated Bedtime Story" },
		});
	});

	it("binds a verified transaction and merges D1 content with live chain facts", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const draft = await (await createDraft(cookie)).json<{ draftId: string }>();

		const bound = await bindDraft(cookie, draft.draftId);
		expect(bound.status).toBe(201);
		const taskKey = buildTaskKey(11155111, marketplace, 42n);
		await expect(bound.json()).resolves.toEqual({ taskKey, created: true });
		expect(reader.lastBindingInput).toMatchObject({
			expectedProvider: provider.address.toLowerCase(),
			expectedMetadataHash: canonicalizeTaskMetadata(metadata).metadataHash,
		});

		const detail = await request(`/api/tasks/${taskKey}`);
		expect(detail.status).toBe(200);
		await expect(detail.json()).resolves.toMatchObject({
			taskKey,
			offchain: { title: "Bedtime Story", videoUrl: metadata.videoUrl },
			onchain: {
				provider: provider.address.toLowerCase(),
				payee,
				status: "PendingReview",
			},
		});
	});

	it("rejects a verified event whose metadata hash differs from D1", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const draft = await (await createDraft(cookie)).json<{ draftId: string }>();
		reader.metadataHashOverride = `0x${"cd".repeat(32)}`;

		const response = await bindDraft(cookie, draft.draftId);
		expect(response.status).toBe(409);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "TASK_METADATA_MISMATCH" },
		});
	});

	it("maps receipt, event, or current-state verification failures", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const draft = await (await createDraft(cookie)).json<{ draftId: string }>();
		reader.verificationError = new Error("receipt event mismatch");

		const response = await bindDraft(cookie, draft.draftId);
		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "TASK_CHAIN_VERIFICATION_FAILED" },
		});
	});

	it("makes identical binding retries idempotent and rejects conflicts", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const firstDraft = await (await createDraft(cookie)).json<{
			draftId: string;
		}>();
		expect((await bindDraft(cookie, firstDraft.draftId)).status).toBe(201);

		const retry = await bindDraft(cookie, firstDraft.draftId);
		expect(retry.status).toBe(200);
		await expect(retry.json()).resolves.toMatchObject({ created: false });

		const conflictingHash = `0x${"ef".repeat(32)}` as const;
		const transactionConflict = await bindDraft(
			cookie,
			firstDraft.draftId,
			conflictingHash,
		);
		expect(transactionConflict.status).toBe(409);

		const secondDraft = await (await createDraft(cookie)).json<{
			draftId: string;
		}>();
		const keyConflict = await bindDraft(cookie, secondDraft.draftId);
		expect(keyConflict.status).toBe(409);
		await expect(keyConflict.json()).resolves.toMatchObject({
			error: { code: "TASK_BINDING_CONFLICT" },
		});
	});

	it("records sanitized draft and binding audit evidence", async () => {
		const provider = account();
		reader.provider = provider.address.toLowerCase() as `0x${string}`;
		const cookie = await login(provider);
		const draft = await (await createDraft(cookie)).json<{ draftId: string }>();
		await bindDraft(cookie, draft.draftId);

		const audits = await env.DB.prepare(
			"SELECT action, detail_json FROM audit_logs WHERE resource_id = ? ORDER BY created_at",
		)
			.bind(draft.draftId)
			.all<{ action: string; detail_json: string }>();
		expect(audits.results.map(({ action }) => action)).toEqual([
			"task-draft.created",
			"task-draft.bound",
		]);
		const serialized = JSON.stringify(audits.results);
		expect(serialized).not.toMatch(/signature|cookie|private.?key/iu);
	});
});
