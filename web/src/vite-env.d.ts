/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ONCHAIN_NOTEBOOK_ADDRESS: string;
	readonly VITE_BABY_COIN_ADDRESS?: string;
	readonly VITE_GROWTH_ACTIVITIES_ADDRESS?: string;
	readonly VITE_GROWTH_CERTIFICATE_ADDRESS?: string;
	readonly VITE_TASK_MARKETPLACE_ADDRESS?: string;
	readonly VITE_GROWTH_CERTIFICATE_SBT_ADDRESS?: string;
	readonly VITE_TASK_MARKETPLACE_V2_ADDRESS?: string;
	readonly VITE_PRIVY_APP_ID?: string;
	readonly VITE_BABYSTEPS_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
