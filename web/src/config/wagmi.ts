import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
	chains: [sepolia],
	connectors: [injected({ target: "metaMask" })],
	transports: {
		// Keep reads on the same RPC proven during deployment; the chain default
		// can rate-limit the page's concurrent notebook and growth queries.
		[sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com"),
	},
});
