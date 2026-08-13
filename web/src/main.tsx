import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { Providers } from "./config/providers";
import { publicAppConfig } from "./contracts/web3Contracts";
import { performanceEventsEndpoint } from "./performance/api";
import { createPerformanceClient } from "./performance/client";
import { setPerformanceClient } from "./performance/runtime";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing.");

createRoot(root).render(
	<StrictMode>
		<Providers>
			<App />
		</Providers>
	</StrictMode>,
);

queueMicrotask(() => {
	const performanceClient = createPerformanceClient({
		endpoint: performanceEventsEndpoint(publicAppConfig.apiUrl),
		environment: import.meta.env.MODE,
		version: import.meta.env.VITE_APP_VERSION ?? "local",
		sampleRate: Number(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE ?? "1"),
		route: () =>
			document.documentElement.dataset.currentView
				? `/${document.documentElement.dataset.currentView}`
				: "/",
	});
	setPerformanceClient(performanceClient);
	performanceClient.start();
});
