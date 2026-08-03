/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_ONCHAIN_NOTEBOOK_ADDRESS: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
