import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const command = process.argv[2];
if (!new Set(["layout", "reference", "test", "approve"]).has(command)) {
	throw new Error(
		"usage: node scripts/run-visual-gate.mjs layout|reference|test|approve",
	);
}

const run = (executable, args, options = {}) =>
	new Promise((resolvePromise, reject) => {
		const child = spawn(executable, args, {
			stdio: "inherit",
			...options,
		});
		child.once("error", reject);
		child.once("exit", (code, signal) => {
			if (code === 0) {
				resolvePromise();
				return;
			}
			reject(
				new Error(
					`${executable} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`,
				),
			);
		});
	});

const root = process.cwd();
const backstop = resolve(root, "node_modules/.bin/backstop");
await access(backstop);

const deterministicVisualEnvironment = {
	VITE_BABYSTEPS_API_URL: "",
	VITE_PRIVY_APP_ID: "",
	VITE_BABY_COIN_ADDRESS: "",
	VITE_GROWTH_ACTIVITIES_ADDRESS: "",
	VITE_GROWTH_CERTIFICATE_ADDRESS: "",
	VITE_TASK_MARKETPLACE_ADDRESS: "",
	VITE_GROWTH_CERTIFICATE_SBT_ADDRESS: "",
	VITE_TASK_MARKETPLACE_V2_ADDRESS: "",
	VITE_STARBUDDY_KEEPSAKE_SBT_ADDRESS: "",
	VITE_STARBUDDY_KEEPSAKES_ADDRESS: "",
};

if (command === "approve") {
	await run(backstop, ["approve", "--config=backstop.config.cjs"], {
		cwd: root,
	});
	process.exit(0);
}

const port = process.env.BACKSTOP_PORT ?? "4176";
const dashboardUrl =
	process.env.BACKSTOP_TEST_URL ??
	`http://127.0.0.1:${port}/performance?mode=history`;
const vite = resolve(root, "web/node_modules/.bin/vite");
await access(vite);

const server = spawn(
	vite,
	[
		"--mode",
		"production",
		"--host",
		"127.0.0.1",
		"--port",
		port,
		"--strictPort",
	],
	{
		cwd: resolve(root, "web"),
		stdio: "inherit",
		env: {
			...process.env,
			...deterministicVisualEnvironment,
		},
	},
);

const waitForServer = async () => {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		try {
			const response = await fetch(dashboardUrl);
			if (response.ok) return;
		} catch {
			// The local server is still starting.
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
	}
	throw new Error(`visual test server did not start: ${dashboardUrl}`);
};

try {
	await waitForServer();
	if (command === "layout") {
		await run(
			process.execPath,
			["--test", "scripts/performance-layout.browser.mjs"],
			{
				cwd: root,
				env: {
					...process.env,
					PERFORMANCE_DASHBOARD_URL: dashboardUrl,
				},
			},
		);
	} else {
		await run(backstop, [command, "--config=backstop.config.cjs"], {
			cwd: root,
			env: {
				...process.env,
				BACKSTOP_TEST_URL: dashboardUrl,
			},
		});
	}
} finally {
	server.kill("SIGTERM");
}
