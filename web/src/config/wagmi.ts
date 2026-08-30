import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

import { measurePerformance } from "../performance/runtime";

const baseRpcTransport = http("https://ethereum-sepolia-rpc.publicnode.com");
const instrumentedRpcTransport: typeof baseRpcTransport = (options) => {
	const transport = baseRpcTransport(options);
	return {
		...transport,
		request: (request, requestOptions) =>
			measurePerformance("rpc.read", () =>
				measurePerformance("web3.rpc.read", () =>
					transport.request(request, requestOptions),
				),
			),
	};
};

export const wagmiConfig = createConfig({
	chains: [sepolia],
	connectors: [injected({ target: "metaMask" })],
	transports: {
		// Keep reads on the same RPC proven during deployment; the chain default
		// can rate-limit the page's concurrent notebook and growth queries.
		[sepolia.id]: instrumentedRpcTransport,
	},
});
