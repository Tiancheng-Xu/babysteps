import { Hono } from "hono";
import { z } from "zod";
import { requireSession, type WorkerApp } from "../auth/session";
import type { MarketplaceReaderFactory } from "../chain/marketplaceReader";
import { parseTaskKey, type TaskKey } from "../domain/taskIdentity";
import { AppError, readJson } from "../http/errors";
import {
	CommentRepository,
	type CommentRow,
} from "../repositories/commentRepository";
import { TaskRepository } from "../repositories/taskRepository";

export type OwnerWalletFactory = (env: Env) => string;

const commentSchema = z.object({ content: z.string() }).strict();

function normalizeContent(value: string): string {
	const content = value.trim();
	const length = [...content].length;
	const hasUnsafeControlCharacter = [...content].some((character) => {
		const codePoint = character.codePointAt(0) ?? 0;
		return (
			codePoint === 127 || (codePoint < 32 && ![9, 10, 13].includes(codePoint))
		);
	});
	if (length < 1 || length > 500 || hasUnsafeControlCharacter) {
		throw new AppError(
			400,
			"COMMENT_CONTENT_INVALID",
			"Comment must be 1 to 500 safe characters",
		);
	}
	return content;
}

function serializeComment(row: CommentRow) {
	return {
		id: row.id,
		taskKey: row.task_key,
		wallet: row.wallet,
		username: row.username ?? null,
		content: row.content,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

async function requirePublishedTask(
	database: D1Database,
	rawKey: string,
): Promise<TaskKey> {
	let taskKey: TaskKey;
	try {
		const parsed = parseTaskKey(rawKey);
		taskKey = `${parsed.chainId}:${parsed.marketplaceAddress}:${parsed.taskId}`;
	} catch {
		throw new AppError(400, "TASK_IDENTITY_INVALID", "Task key is invalid");
	}
	if (!(await new TaskRepository(database).findPublished(taskKey))) {
		throw new AppError(404, "TASK_NOT_FOUND", "Published task was not found");
	}

	return taskKey;
}

async function readCommentContent(request: Request): Promise<string> {
	const input = commentSchema.safeParse(await readJson(request));
	if (!input.success) {
		throw new AppError(
			400,
			"COMMENT_CONTENT_INVALID",
			"Comment must be 1 to 500 safe characters",
		);
	}
	return normalizeContent(input.data.content);
}

export function createCommentRoutes(
	readerFactory: MarketplaceReaderFactory,
	ownerWalletFactory: OwnerWalletFactory,
) {
	const routes = new Hono<WorkerApp>();

	routes.get("/tasks/:taskKey/comments", async (context) => {
		const taskKey = await requirePublishedTask(
			context.env.DB,
			context.req.param("taskKey"),
		);
		const comments = await new CommentRepository(context.env.DB).listVisible(
			taskKey,
		);

		return context.json({ comments: comments.map(serializeComment) });
	});

	routes.post("/tasks/:taskKey/comments", requireSession, async (context) => {
		const taskKey = await requirePublishedTask(
			context.env.DB,
			context.req.param("taskKey"),
		);
		const wallet = context.get("wallet") as `0x${string}`;
		let purchaseId: bigint;
		try {
			purchaseId = await readerFactory(context.env).purchaseIdForBuyer(
				taskKey,
				wallet,
			);
		} catch {
			throw new AppError(
				503,
				"CHAIN_READ_UNAVAILABLE",
				"Purchase status could not be verified",
			);
		}
		if (purchaseId === 0n) {
			throw new AppError(
				403,
				"TASK_PURCHASE_REQUIRED",
				"An on-chain purchase is required to comment",
			);
		}
		const comment = await new CommentRepository(context.env.DB).create(
			taskKey,
			wallet,
			await readCommentContent(context.req.raw),
			Math.floor(Date.now() / 1000),
		);

		return context.json(serializeComment(comment), 201);
	});

	routes.put("/comments/:commentId", requireSession, async (context) => {
		const repository = new CommentRepository(context.env.DB);
		const comment = await repository.find(context.req.param("commentId"));
		if (!comment) {
			throw new AppError(404, "COMMENT_NOT_FOUND", "Comment was not found");
		}
		if (comment.wallet !== context.get("wallet")) {
			throw new AppError(
				403,
				"COMMENT_FORBIDDEN",
				"Only the author may edit this comment",
			);
		}
		if (comment.hidden_at !== null) {
			throw new AppError(
				409,
				"COMMENT_HIDDEN",
				"A hidden comment cannot be edited",
			);
		}
		const updated = await repository.update(
			comment,
			await readCommentContent(context.req.raw),
			Math.floor(Date.now() / 1000),
		);

		return context.json(serializeComment(updated));
	});

	routes.post("/comments/:commentId/hide", requireSession, async (context) => {
		const wallet = context.get("wallet");
		if (wallet !== ownerWalletFactory(context.env).toLowerCase()) {
			throw new AppError(403, "OWNER_REQUIRED", "Only Owner may hide comments");
		}
		const repository = new CommentRepository(context.env.DB);
		const comment = await repository.find(context.req.param("commentId"));
		if (!comment) {
			throw new AppError(404, "COMMENT_NOT_FOUND", "Comment was not found");
		}
		const hidden = await repository.hide(
			comment,
			wallet,
			Math.floor(Date.now() / 1000),
		);

		return context.json({ id: hidden.id, hidden: true });
	});

	return routes;
}
