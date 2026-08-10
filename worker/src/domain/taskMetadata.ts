import { keccak256, toBytes } from "viem";
import { z } from "zod";

const httpsUrl = (field: string) =>
	z
		.url({ message: `${field} must use HTTPS` })
		.max(2048, {
			message: `${field} must use HTTPS and be at most 2048 characters`,
		})
		.refine((value) => new URL(value).protocol === "https:", {
			message: `${field} must use HTTPS`,
		});

const metadataSchema = z
	.object({
		title: z
			.string()
			.trim()
			.min(2, "title is too short")
			.max(80, "title is too long"),
		description: z
			.string()
			.trim()
			.min(10, "description is too short")
			.max(2000, "description is too long"),
		coverUrl: httpsUrl("coverUrl"),
		videoUrl: httpsUrl("videoUrl"),
		completionInstructions: z
			.string()
			.trim()
			.min(10, "completion instructions are too short")
			.max(1000, "completion instructions are too long"),
		activityType: z.enum(["Meal", "Walk", "Read"], {
			error: "activity type is invalid",
		}),
	})
	.strict();

export type TaskMetadata = z.infer<typeof metadataSchema>;

export function canonicalizeTaskMetadata(input: unknown): {
	metadata: TaskMetadata;
	canonicalJson: string;
	metadataHash: `0x${string}`;
} {
	const result = metadataSchema.safeParse(input);
	if (!result.success) {
		const issue = result.error.issues[0];
		if (issue?.code === "unrecognized_keys") {
			throw new Error("unknown field in task metadata");
		}
		throw new Error(issue?.message ?? "task metadata is invalid");
	}
	const metadata: TaskMetadata = {
		title: result.data.title,
		description: result.data.description,
		coverUrl: result.data.coverUrl,
		videoUrl: result.data.videoUrl,
		completionInstructions: result.data.completionInstructions,
		activityType: result.data.activityType,
	};
	const canonicalJson = JSON.stringify(metadata);

	return {
		metadata,
		canonicalJson,
		metadataHash: keccak256(toBytes(canonicalJson)),
	};
}
