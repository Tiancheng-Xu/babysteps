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
const metadata = canonicalizeTaskMetadata({
	title: "Bedtime Story",
	description: "Read one picture book together before sleep.",
	coverUrl: "https://cdn.baby2b.online/tasks/read-cover.webp",
	videoUrl: "https://cdn.baby2b.online/tasks/read-guide.mp4",
	completionInstructions: "Finish the story and confirm completion.",
	activityType: "Read",
});

class CommentMarketplaceReader implements MarketplaceReader {
	purchaseId = 0n;
	purchaseError: Error | null = null;

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
		if (this.purchaseError) throw this.purchaseError;
		return this.purchaseId;
	}
}

let reader: CommentMarketplaceReader;
let owner: PrivateKeyAccount;
let request: TestRequest;

function account() {
	return privateKeyToAccount(generatePrivateKey());
}

async function login(wallet: PrivateKeyAccount): Promise<string> {
	const challenge = await createChallenge(wallet, "login", request);
	return cookieFrom(await createSession(wallet, challenge, request));
}

async function postComment(
	cookie: string,
	content = "A helpful bedtime routine.",
) {
	return request(`/api/tasks/${taskKey}/comments`, {
		method: "POST",
		headers: { "content-type": "application/json", cookie },
		body: JSON.stringify({ content }),
	});
}

beforeEach(async () => {
	await env.DB.batch([
		env.DB.prepare("DELETE FROM audit_logs WHERE resource_type = 'comment'"),
		env.DB.prepare("DELETE FROM comments"),
		env.DB.prepare("DELETE FROM published_tasks"),
		env.DB.prepare("DELETE FROM task_drafts"),
	]);
	const now = Math.floor(Date.now() / 1000);
	const draftId = crypto.randomUUID();
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

	reader = new CommentMarketplaceReader();
	owner = account();
	request = requestFor(
		createApp({
			marketplaceReaderFactory: () => reader,
			ownerWalletFactory: () => owner.address.toLowerCase(),
		}),
	);
});

describe("purchase-gated comments", () => {
	it("allows public reads but requires a session for writes", async () => {
		const list = await request(`/api/tasks/${taskKey}/comments`);
		expect(list.status).toBe(200);
		await expect(list.json()).resolves.toEqual({ comments: [] });

		const write = await postComment("");
		expect(write.status).toBe(401);
	});

	it("rejects a signed-in wallet without an on-chain purchase", async () => {
		const parent = account();
		const cookie = await login(parent);
		reader.purchaseId = 0n;

		const response = await postComment(cookie);
		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "TASK_PURCHASE_REQUIRED" },
		});
	});

	it("creates and publicly lists a purchaser comment as plain data", async () => {
		const parent = account();
		const cookie = await login(parent);
		reader.purchaseId = 7n;

		const created = await postComment(cookie, "  <b>Useful</b> bedtime tip.  ");
		expect(created.status).toBe(201);
		const comment = await created.json<{ id: string; content: string }>();
		expect(comment.content).toBe("<b>Useful</b> bedtime tip.");

		const list = await request(`/api/tasks/${taskKey}/comments`);
		expect(list.status).toBe(200);
		await expect(list.json()).resolves.toMatchObject({
			comments: [
				{
					id: comment.id,
					wallet: parent.address.toLowerCase(),
					content: "<b>Useful</b> bedtime tip.",
				},
			],
		});
	});

	it("lets only the author edit a visible comment", async () => {
		const author = account();
		reader.purchaseId = 8n;
		const authorCookie = await login(author);
		const comment = await (await postComment(authorCookie)).json<{
			id: string;
		}>();
		const otherCookie = await login(account());

		const forbidden = await request(`/api/comments/${comment.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json", cookie: otherCookie },
			body: JSON.stringify({ content: "Trying to overwrite" }),
		});
		expect(forbidden.status).toBe(403);

		const updated = await request(`/api/comments/${comment.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json", cookie: authorCookie },
			body: JSON.stringify({ content: "Updated by the author" }),
		});
		expect(updated.status).toBe(200);
		await expect(updated.json()).resolves.toMatchObject({
			content: "Updated by the author",
		});
	});

	it.each(["", "\u0000unsafe", "x".repeat(501)])(
		"rejects invalid comment content %j",
		async (content) => {
			const parent = account();
			reader.purchaseId = 9n;
			const response = await postComment(await login(parent), content);

			expect(response.status).toBe(400);
			await expect(response.json()).resolves.toMatchObject({
				error: { code: "COMMENT_CONTENT_INVALID" },
			});
		},
	);

	it("never treats a chain read failure as purchase authorization", async () => {
		const parent = account();
		const cookie = await login(parent);
		reader.purchaseError = new Error("RPC unavailable");

		const response = await postComment(cookie);
		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "CHAIN_READ_UNAVAILABLE" },
		});
	});

	it("allows only Owner to soft-hide and audit a comment", async () => {
		const author = account();
		reader.purchaseId = 10n;
		const authorCookie = await login(author);
		const comment = await (await postComment(authorCookie)).json<{
			id: string;
		}>();
		const nonOwnerCookie = await login(account());

		const forbidden = await request(`/api/comments/${comment.id}/hide`, {
			method: "POST",
			headers: { cookie: nonOwnerCookie },
		});
		expect(forbidden.status).toBe(403);

		const ownerCookie = await login(owner);
		const hidden = await request(`/api/comments/${comment.id}/hide`, {
			method: "POST",
			headers: { cookie: ownerCookie },
		});
		expect(hidden.status).toBe(200);
		await expect(hidden.json()).resolves.toMatchObject({ hidden: true });

		const list = await request(`/api/tasks/${taskKey}/comments`);
		await expect(list.json()).resolves.toEqual({ comments: [] });
		const audit = await env.DB.prepare(
			"SELECT actor_wallet, action FROM audit_logs WHERE resource_type = 'comment' AND resource_id = ? AND action = 'comment.hidden'",
		)
			.bind(comment.id)
			.first<{ actor_wallet: string; action: string }>();
		expect(audit).toEqual({
			actor_wallet: owner.address.toLowerCase(),
			action: "comment.hidden",
		});

		const editHidden = await request(`/api/comments/${comment.id}`, {
			method: "PUT",
			headers: { "content-type": "application/json", cookie: authorCookie },
			body: JSON.stringify({ content: "Cannot edit hidden comment" }),
		});
		expect(editHidden.status).toBe(409);
	});
});
