import { z } from "zod";
import { AppError } from "./http/errors";

const configSchema = z.object({
	APP_DOMAIN: z.string().min(1),
	APP_URI: z.url(),
	CHAIN_ID: z.coerce.number().int().positive(),
	OWNER_WALLET: z.string().min(1),
});

export type AppConfig = {
	domain: string;
	uri: string;
	chainId: number;
	ownerWallet: string;
};

export function readConfig(env: Env): AppConfig {
	const result = configSchema.safeParse(env);
	if (!result.success) {
		throw new AppError(
			500,
			"CONFIG_INVALID",
			"Service configuration is invalid",
		);
	}

	return {
		domain: result.data.APP_DOMAIN,
		uri: result.data.APP_URI,
		chainId: result.data.CHAIN_ID,
		ownerWallet: result.data.OWNER_WALLET.toLowerCase(),
	};
}
