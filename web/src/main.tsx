import { StrictMode, useEffect, useRef, useState } from "react";

import App from "./App";
import { bootstrapClient, readRenderStateFromDocument } from "./bootstrap";
import { Providers } from "./config/providers";
import { publicAppConfig } from "./contracts/web3Contracts";
import { performanceEventsEndpoint } from "./performance/api";
import { createPerformanceClient } from "./performance/client";
import { setPerformanceClient } from "./performance/runtime";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing.");

const performanceClient = createPerformanceClient({
	endpoint: performanceEventsEndpoint(publicAppConfig.apiUrl),
	environment: import.meta.env.MODE,
	version: import.meta.env.VITE_APP_VERSION ?? "local",
	sampleRate: Number(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE ?? "1"),
	maxEventsPerMinute: Number(
		import.meta.env.VITE_PERFORMANCE_MAX_EVENTS_PER_MINUTE ?? "120",
	),
	reportAllWebVitalChanges:
		import.meta.env.VITE_PERFORMANCE_REPORT_ALL_CHANGES === "true",
	route: () => globalThis.location?.pathname ?? "/",
});
setPerformanceClient(performanceClient);
performanceClient.start();

const hydrationStartedAt = performance.now();
const buildVersion = import.meta.env.VITE_APP_VERSION ?? "unknown";

function ClientApplication({
	initialInteractive,
}: {
	initialInteractive: boolean;
}) {
	const [interactive, setInteractive] = useState(initialInteractive);
	const reported = useRef(false);
	useEffect(() => {
		if (!reported.current && !initialInteractive) {
			reported.current = true;
			performanceClient.record({
				type: "custom",
				name: "hydration.duration",
				value: performance.now() - hydrationStartedAt,
				unit: "ms",
			});
		}
		setInteractive(true);
	}, [initialInteractive]);

	return (
		<StrictMode>
			{interactive ? (
				<Providers>
					<App interactive />
				</Providers>
			) : (
				<App interactive={false} />
			)}
		</StrictMode>
	);
}

bootstrapClient({
	root,
	state: readRenderStateFromDocument(),
	currentPathname: globalThis.location.pathname,
	buildVersion,
	buildApplication: (interactive) => (
		<ClientApplication initialInteractive={interactive} />
	),
	record: (event) => performanceClient.record(event),
});
