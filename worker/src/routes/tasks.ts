import { Hono } from "hono";
import { isAddress } from "viem";
import { z } from "zod";
import { requireSession, type WorkerApp } from "../auth/session";
import type {
	ChainTaskView,
	MarketplaceReader,
	MarketplaceReaderFactory,
	VerifiedTaskBinding,
} from "../chain/marketplaceReader";
import {
	buildTaskKey,
	parseTaskKey,
	type TaskKey,
} from "../domain/taskIdentity";
import { canonicalizeTaskMetadata } from "../domain/taskMetadata";
import { AppError, readJson } from "../http/errors";
import { TaskRepository } from "../repositories/taskRepository";

const bindingSchema = z
	.object({
		chainId: z.number().int().positive(),
		marketplaceAddress: z.string(),
		taskId: z.string().regex(/^[1-9]\d*$/u),
		transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/u),
	})
	.strict();

async function requireProvider(
	reader: MarketplaceReader,
	wallet: string,
): Promise<void> {
	let hasRole: boolean;
	try {
		hasRole = await reader.hasProviderRole(wallet as `0x${string}`);
	} catch {
		throw new AppError(
			503,
			"CHAIN_READ_UNAVAILABLE",
			"Provider role could not be verified",
		);
	}
	if (!hasRole) {
		throw new AppError(
			403,
			"PROVIDER_ROLE_REQUIRED",
			"Provider role is required",
		);
	}
}

function assertDraftOwner(providerWallet: string, actorWallet: string): void {
	if (providerWallet !== actorWallet) {
		throw new AppError(
			403,
			"TASK_DRAFT_FORBIDDEN",
			"Only the draft owner may change it",
		);
	}
}

function serializeChainTask(
	task: Awaited<ReturnType<MarketplaceReader["readTask"]>>,
) {
	return {
		...task,
		taskId: task.taskId.toString(),
		priceWei: task.priceWei.toString(),
		opensAt: task.opensAt.toString(),
		closesAt: task.closesAt.toString(),
	};
}

function publicTaskMetadata(metadataJson: string) {
	const metadata = JSON.parse(metadataJson) as {
		title: string;
		description: string;
		coverUrl: string;
		videoUrl: string;
		completionInstructions: string;
		activityType: string;
	};
	return {
		title: metadata.title,
		description: metadata.description,
		coverUrl: metadata.coverUrl,
		activityType: metadata.activityType,
	};
}

function normalizeTaskKey(rawKey: string): TaskKey {
	try {
		const parsedKey = parseTaskKey(rawKey);
		return buildTaskKey(
			parsedKey.chainId,
			parsedKey.marketplaceAddress,
			parsedKey.taskId,
		);
	} catch {
		throw new AppError(400, "TASK_IDENTITY_INVALID", "Task key is invalid");
	}
}

export function createTaskRoutes(readerFactory: MarketplaceReaderFactory) {
	const routes = new Hono<WorkerApp>();

	routes.post("/task-drafts", requireSession, async (context) => {
		const wallet = context.get("wallet");
		await requireProvider(readerFactory(context.env), wallet);
		let canonical: ReturnType<typeof canonicalizeTaskMetadata>;
		try {
			canonical = canonicalizeTaskMetadata(await readJson(context.req.raw));
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				400,
				"TASK_METADATA_INVALID",
				(error as Error).message,
			);
		}
		const draft = await new TaskRepository(context.env.DB).createDraft(
			wallet,
			canonical.metadata,
			canonical.canonicalJson,
			canonical.metadataHash,
			Math.floor(Date.now() / 1000),
		);

		return context.json(
			{
				draftId: draft.id,
				metadata: canonical.metadata,
				metadataHash: canonical.metadataHash,
			},
			201,
		);
	});

	routes.put("/task-drafts/:draftId", requireSession, async (context) => {
		const wallet = context.get("wallet");
		await requireProvider(readerFactory(context.env), wallet);
		const repository = new TaskRepository(context.env.DB);
		const draft = await repository.findDraft(context.req.param("draftId"));
		if (!draft) {
			throw new AppError(
				404,
				"TASK_DRAFT_NOT_FOUND",
				"Task draft was not found",
			);
		}
		assertDraftOwner(draft.provider_wallet, wallet);
		if (await repository.findPublishedByDraft(draft.id)) {
			throw new AppError(
				409,
				"TASK_DRAFT_BOUND",
				"A bound draft cannot be changed",
			);
		}
		let canonical: ReturnType<typeof canonicalizeTaskMetadata>;
		try {
			canonical = canonicalizeTaskMetadata(await readJson(context.req.raw));
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				400,
				"TASK_METADATA_INVALID",
				(error as Error).message,
			);
		}
		const updated = await repository.updateDraft(
			draft,
			canonical.metadata,
			canonical.canonicalJson,
			canonical.metadataHash,
			Math.floor(Date.now() / 1000),
		);

		return context.json({
			draftId: updated.id,
			metadata: canonical.metadata,
			metadataHash: updated.metadata_hash,
		});
	});

	routes.post("/task-drafts/:draftId/bind", requireSession, async (context) => {
		const wallet = context.get("wallet");
		const reader = readerFactory(context.env);
		await requireProvider(reader, wallet);
		const repository = new TaskRepository(context.env.DB);
		const draft = await repository.findDraft(context.req.param("draftId"));
		if (!draft) {
			throw new AppError(
				404,
				"TASK_DRAFT_NOT_FOUND",
				"Task draft was not found",
			);
		}
		assertDraftOwner(draft.provider_wallet, wallet);
		const parsed = bindingSchema.safeParse(await readJson(context.req.raw));
		if (!parsed.success || !isAddress(parsed.data.marketplaceAddress)) {
			throw new AppError(
				400,
				"TASK_BINDING_INVALID",
				"Task binding input is invalid",
			);
		}
		const taskKey = buildTaskKey(
			parsed.data.chainId,
			parsed.data.marketplaceAddress as `0x${string}`,
			BigInt(parsed.data.taskId),
		);
		const transactionHash =
			parsed.data.transactionHash.toLowerCase() as `0x${string}`;
		const existing = await repository.findPublishedByDraft(draft.id);
		if (existing) {
			if (
				existing.task_key === taskKey &&
				existing.transaction_hash === transactionHash &&
				existing.metadata_hash === draft.metadata_hash
			) {
				return context.json({ taskKey, created: false });
			}
			throw new AppError(
				409,
				"TASK_BINDING_CONFLICT",
				"Draft already has a different binding",
			);
		}
		if (await repository.findPublished(taskKey)) {
			throw new AppError(
				409,
				"TASK_BINDING_CONFLICT",
				"Task key is already bound",
			);
		}

		let verified: VerifiedTaskBinding;
		try {
			verified = await reader.verifyTaskBinding({
				chainId: parsed.data.chainId,
				marketplaceAddress: taskKey.split(":")[1] as `0x${string}`,
				taskId: BigInt(parsed.data.taskId),
				transactionHash,
				expectedProvider: wallet as `0x${string}`,
				expectedMetadataHash: draft.metadata_hash,
			});
		} catch {
			throw new AppError(
				422,
				"TASK_CHAIN_VERIFICATION_FAILED",
				"Transaction, event, and current task state could not be verified",
			);
		}
		if (verified.task.metadataHash !== draft.metadata_hash) {
			throw new AppError(
				409,
				"TASK_METADATA_MISMATCH",
				"Chain and D1 metadata hashes differ",
			);
		}
		const metadata = JSON.parse(draft.metadata_json) as {
			activityType: string;
		};
		if (
			verified.task.taskKey !== taskKey ||
			verified.task.provider.toLowerCase() !== wallet ||
			verified.task.activityType !== metadata.activityType
		) {
			throw new AppError(
				422,
				"TASK_CHAIN_VERIFICATION_FAILED",
				"Verified task facts do not match the draft",
			);
		}

		await repository.bindTask(
			{
				task_key: taskKey,
				draft_id: draft.id,
				chain_id: parsed.data.chainId,
				marketplace_address: taskKey.split(":")[1] as `0x${string}`,
				task_id: parsed.data.taskId,
				transaction_hash: transactionHash,
				metadata_hash: draft.metadata_hash,
				created_at: Math.floor(Date.now() / 1000),
			},
			wallet,
		);

		return context.json({ taskKey, created: true }, 201);
	});

	routes.get("/tasks/:taskKey", async (context) => {
		const taskKey = normalizeTaskKey(context.req.param("taskKey"));
		const published = await new TaskRepository(context.env.DB).findPublished(
			taskKey,
		);
		if (!published) {
			throw new AppError(404, "TASK_NOT_FOUND", "Published task was not found");
		}
		let chainTask: ChainTaskView;
		try {
			chainTask = await readerFactory(context.env).readTask(taskKey);
		} catch {
			throw new AppError(
				503,
				"CHAIN_READ_UNAVAILABLE",
				"Task facts could not be read",
			);
		}
		if (chainTask.metadataHash !== published.metadata_hash) {
			throw new AppError(
				409,
				"TASK_METADATA_MISMATCH",
				"Chain and D1 metadata hashes differ",
			);
		}
		const draft = await new TaskRepository(context.env.DB).findDraft(
			published.draft_id,
		);
		if (!draft) {
			throw new AppError(
				500,
				"TASK_CONTENT_MISSING",
				"Published task content is missing",
			);
		}

		return context.json({
			taskKey,
			offchain: publicTaskMetadata(draft.metadata_json),
			onchain: serializeChainTask(chainTask),
		});
	});

	routes.get("/tasks/:taskKey/content", requireSession, async (context) => {
		const taskKey = normalizeTaskKey(context.req.param("taskKey"));
		const repository = new TaskRepository(context.env.DB);
		const published = await repository.findPublished(taskKey);
		if (!published) {
			throw new AppError(404, "TASK_NOT_FOUND", "Published task was not found");
		}
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
				"An on-chain purchase is required to unlock task content",
			);
		}
		const draft = await repository.findDraft(published.draft_id);
		if (!draft) {
			throw new AppError(
				500,
				"TASK_CONTENT_MISSING",
				"Published task content is missing",
			);
		}
		const metadata = JSON.parse(draft.metadata_json) as {
			videoUrl: string;
			completionInstructions: string;
		};
		return context.json({
			taskKey,
			purchaseId: purchaseId.toString(),
			videoUrl: metadata.videoUrl,
			completionInstructions: metadata.completionInstructions,
		});
	});

	return routes;
}
