import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sepolia } from "viem/chains";
import { WagmiProvider } from "wagmi";

import { publicAppConfig } from "../contracts/web3Contracts";
import { wagmiConfig } from "./wagmi";

const queryClient = new QueryClient();

type ProvidersProps = {
	children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
	const application = (
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</WagmiProvider>
	);

	if (!publicAppConfig.privyAppId) return application;

	return (
		<PrivyProvider
			appId={publicAppConfig.privyAppId}
			config={{
				loginMethods: ["google", "email", "wallet"],
				defaultChain: sepolia,
				supportedChains: [sepolia],
				embeddedWallets: {
					ethereum: { createOnLogin: "users-without-wallets" },
				},
				appearance: {
					theme: "light",
					accentColor: "#6f5ca8",
					landingHeader: "登录 BabySteps",
					loginMessage: "使用 Google、邮箱或外部钱包进入成长星球。",
					walletList: [
						"metamask",
						"coinbase_wallet",
						"rainbow",
						"wallet_connect_qr",
					],
				},
			}}
		>
			<SmartWalletsProvider>{application}</SmartWalletsProvider>
		</PrivyProvider>
	);
}
