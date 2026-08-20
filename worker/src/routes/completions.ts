import { Hono } from "hono";
import { keccak256, stringToBytes } from "viem";
import { z } from "zod";
import { requireSession, type WorkerApp } from "../auth/session";
import type { MarketplaceReaderFactory } from "../chain/marketplaceReader";
import { buildTaskKey, parseTaskKey } from "../domain/taskIdentity";
import { AppError, readJson } from "../http/errors";
import {
	CompletionRepository,
	type CompletionSubmissionRow,
} from "../repositories/completionRepository";
import { TaskRepository } from "../repositories/taskRepository";
import type { OwnerWalletFactory } from "./comments";

const submissionSchema = z
	.object({
		evidence: z.string(),
		certificateUri: z.string(),
	})
	.strict();

const sensitiveEvidence =
	/(?:儿童姓名|孩子姓名|姓名[:：]|生日|学校|住址|家庭地址|手机号|身份证|病历|诊断)/u;

function normalizeEvidence(value: string): string {
	const evidence = value.trim();
	const characters = [...evidence];
	const hasUnsafeControl = characters.some((character) => {
		const point = character.codePointAt(0) ?? 0;
		return point === 127 || (point < 32 && ![9, 10, 13].includes(point));
	});
	if (
		characters.length < 2 ||
		characters.length > 280 ||
		hasUnsafeControl ||
		sensitiveEvidence.test(evidence)
	) {
		throw new AppError(
			400,
			"COMPLETION_EVIDENCE_INVALID",
			"Completion evidence must be 2 to 280 safe characters without child personal data",
		);
	}
	return evidence;
}

function normalizeCertificateUri(value: string): string {
	const uri = value.trim();
	if (uri.startsWith("ipfs://")) return uri;
	try {
		const parsed = new URL(uri);
		if (parsed.protocol === "https:") return parsed.toString();
	} catch {
		// Mapped to the stable error below.
	}
	throw new AppError(
		400,
		"CERTIFICATE_URI_INVALID",
		"Certificate metadata must use HTTPS or IPFS",
	);
}

function normalizeTaskKey(raw: string) {
	try {
		const parsed = parseTaskKey(raw);
		return buildTaskKey(
			parsed.chainId,
			parsed.marketplaceAddress,
			parsed.taskId,
		);
	} catch {
		throw new AppError(400, "TASK_IDENTITY_INVALID", "Task key is invalid");
	}
}

function serialize(row: CompletionSubmissionRow, created?: boolean) {
	return {
		id: row.id,
		taskKey: row.task_key,
		purchaseId: row.purchase_id,
		buyerWallet: row.buyer_wallet,
		evidence: row.evidence_text,
		evidenceHash: row.evidence_hash,
		certificateUri: row.certificate_uri,
		createdAt: row.created_at,
		...(created === undefined ? {} : { created }),
	};
}

export function createCompletionRoutes(
	readerFactory: MarketplaceReaderFactory,
	ownerWalletFactory: OwnerWalletFactory,
) {
	const routes = new Hono<WorkerApp>();

	routes.post(
		"/tasks/:taskKey/completions",
		requireSession,
		async (context) => {
			const taskKey = normalizeTaskKey(context.req.param("taskKey"));
			if (!(await new TaskRepository(context.env.DB).findPublished(taskKey))) {
				throw new AppError(
					404,
					"TASK_NOT_FOUND",
					"Published task was not found",
				);
			}
			const input = submissionSchema.safeParse(await readJson(context.req.raw));
			if (!input.success) {
				throw new AppError(
					400,
					"COMPLETION_EVIDENCE_INVALID",
					"Completion submission is invalid",
				);
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
					"An on-chain purchase is required to submit completion",
				);
			}

			const evidence = normalizeEvidence(input.data.evidence);
			const certificateUri = normalizeCertificateUri(input.data.certificateUri);
			const evidenceHash = keccak256(
				stringToBytes(
					JSON.stringify({
						taskKey,
						purchaseId: purchaseId.toString(),
						buyerWallet: wallet,
						evidence,
					}),
				),
			);
			const repository = new CompletionRepository(context.env.DB);
			const existing = await repository.findByPurchaseId(purchaseId.toString());
			if (existing) {
				if (
					existing.buyer_wallet === wallet &&
					existing.evidence_hash === evidenceHash &&
					existing.certificate_uri === certificateUri
				) {
					return context.json(serialize(existing, false));
				}
				throw new AppError(
					409,
					"COMPLETION_EVIDENCE_CONFLICT",
					"This purchase already has different completion evidence",
				);
			}

			const created = await repository.create(
				{
					task_key: taskKey,
					purchase_id: purchaseId.toString(),
					buyer_wallet: wallet,
					evidence_text: evidence,
					evidence_hash: evidenceHash,
					certificate_uri: certificateUri,
				},
				wallet,
				Math.floor(Date.now() / 1000),
			);
			return context.json(serialize(created, true), 201);
		},
	);

	routes.get("/completions", requireSession, async (context) => {
		if (
			context.get("wallet") !== ownerWalletFactory(context.env).toLowerCase()
		) {
			throw new AppError(
				403,
				"OWNER_REQUIRED",
				"Only Owner may review completion submissions",
			);
		}
		const completions = await new CompletionRepository(context.env.DB).list();
		return context.json({
			completions: completions.map((row) => serialize(row)),
		});
	});

	return routes;
}
