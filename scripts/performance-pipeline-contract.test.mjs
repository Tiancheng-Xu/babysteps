import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

test("the AWS unit suite owns the executable performance event contract", async () => {
	const source = await readFile("aws/test/performancePipeline.test.ts", "utf8");

	assert.match(source, /parsePerformanceBatch/);
	assert.match(source, /accepts v1 and v2 whitelisted events/);
	assert.match(source, /schemaVersion:\s*1/);
	assert.match(source, /schemaVersion:\s*2/);
	assert.match(source, /https:\/\/private\.example\/a\?token=x/);
});

test("performance workflow is manual, OIDC-only, validated and self-cleaning", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	const workflow = parse(source);
	assert.ok(workflow);
	const localCoverage = workflow.jobs["local-coverage"];
	assert.ok(localCoverage, "local coverage job must gate AWS creation");
	assert.deepEqual(workflow.jobs["prove-and-clean"].needs, [
		"validate",
		"local-coverage",
	]);
	assert.match(
		localCoverage.steps.map((step) => step.run ?? "").join("\n"),
		/--local-coverage/,
	);
	const localCoverageScript = localCoverage.steps
		.map((step) => step.run ?? "")
		.join("\n");
	assert.match(localCoverageScript, /seq 1 90/);
	assert.match(localCoverageScript, /kill -0 "\$web_pid"/);
	assert.match(localCoverageScript, /tail -n 80 "\$web_log"/);
	assert.doesNotMatch(
		JSON.stringify(localCoverage),
		/aws-performance|id-token/,
	);
	for (const job of Object.values(workflow.jobs)) {
		for (const step of job.steps ?? []) {
			assert.doesNotMatch(
				step.run ?? "",
				/\$\{\{\s*inputs\./,
				`${step.name ?? "unnamed step"} interpolates an untrusted input into shell`,
			);
		}
	}
	assert.match(
		source,
		/APPROVAL_REFERENCE:\s*\$\{\{ inputs\.approval_reference \}\}/,
	);
	assert.match(source, /workflow_dispatch:/);
	assert.match(source, /environment: aws-performance/);
	assert.match(source, /id-token: write/);
	assert.match(source, /docker\/setup-qemu-action@v3/);
	assert.match(source, /platforms: arm64/);
	assert.match(source, /docker\/setup-buildx-action@v3/);
	assert.match(source, /timeout-minutes:\s*50/);
	assert.match(source, /delete-stack/);
	assert.match(source, /concurrency:/);
	assert.match(source, /github\.run_id/);
	assert.match(source, /schema-cleanup/);
	assert.match(source, /schemaDeleted.*true/s);
	assert.match(source, /ecs list-tasks/);
	assert.match(source, /ecsTasks/);
	assert.match(source, /cleanup-incomplete\.json/);
	assert.match(source, /data-retention verification/);
	assert.match(source, /DatabaseAdminTaskDefinitionArn/);
	assert.match(source, /id: deploy/);
	assert.match(source, /steps\.schema-cleanup\.outcome == 'success'/);
	assert.match(source, /steps\.database-init\.outputs\.task == ''/);
	assert.match(source, /steps\.database-init\.outputs\.task != ''/);
	assert.match(source, /describe-stacks --stack-name "\$STACK_NAME"/);
	assert.match(source, /Start temporary Worker proxy/);
	assert.match(source, /wrangler dev --local/);
	assert.match(source, /run-performance-browser-journey\.mjs/);
	assert.match(source, /RUN_STARTED_AT_MS=/);
	assert.match(source, /--expected-version "\$\{GITHUB_SHA:0:12\}"/);
	assert.match(source, /--expected-environment production/);
	assert.match(source, /--expected-window 1h/);
	assert.match(source, /--min-latest-sample-at "\$RUN_STARTED_AT_MS"/);
	assert.match(source, /--required-routes-json/);
	assert.match(source, /playwright install --with-deps chromium/);
	assert.match(source, /APP_URI=http:\/\/127\.0\.0\.1:/);
	assert.match(source, /Browser journey/);
	assert.match(source, /PERFORMANCE_ORIGIN_TOKEN/);
	assert.match(source, /approvalReferenceSha256/);
	assert.match(source, /logs get-log-events/);
	assert.match(source, /cleaner\/cleaner\/\$task_id/);
	assert.match(source, /evidence\/cleaner-summary\.json/);
	assert.match(source, /retryableFailures/);
	assert.doesNotMatch(source, /event\.json/);
	assert.doesNotMatch(source, /value:\s*321|p50\s*!==\s*321/);
	for (const inventory of [
		"cloudformation",
		"ecr",
		"ecs",
		"task-definition",
		"sqs",
		"apigatewayv2",
		"lambda",
		"logs",
		"secretsmanager",
		"security-groups",
		"iam",
	]) {
		assert.match(source, new RegExp(inventory));
	}
	assert.match(source, /shared.*(?:explicit deny|protected)/is);
	assert.match(source, /remainingProjectResources/);
	assert.match(source, /test "\$remaining" = "0"/);
	assert.doesNotMatch(
		source,
		/curl[^\n]*x-babysteps-origin-token[^\n]*\$api\/events/,
	);
	assert.doesNotMatch(source, /evidence\/worker-proxy\.log/);
	assert.doesNotMatch(source, /^\s*(?:push|schedule):/m);
	assert.doesNotMatch(source, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});

test("the cleaner task has a hard workflow watchdog that preserves cleanup time", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	const workflow = parse(source);
	const cleaner = Object.values(workflow.jobs)
		.flatMap((job) => job.steps ?? [])
		.find((step) => step.name === "Run one on-demand ECS cleaning task");

	assert.ok(cleaner, "cleaner workflow step is missing");
	assert.doesNotMatch(cleaner.run, /aws ecs wait tasks-stopped/);
	assert.match(cleaner.run, /CLEANER_WATCHDOG_MAX_ATTEMPTS=36/);
	assert.match(cleaner.run, /CLEANER_WATCHDOG_INTERVAL_SECONDS=5/);
	assert.match(cleaner.run, /aws ecs stop-task/);
	assert.match(
		cleaner.run,
		/--reason "babysteps-performance-cleaner-time-budget-exceeded"/,
	);
	assert.match(cleaner.run, /CLEANER_TASK_DID_NOT_STOP_AFTER_WATCHDOG/);
});

test("the AWS workspace owns the cleaner bundler required by a clean CI install", async () => {
	const packageJson = JSON.parse(await readFile("aws/package.json", "utf8"));
	assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
	assert.match(packageJson.scripts["build:performance:cleaner"], /^esbuild /);
});

test("the Chromium journey emits only a bounded sanitized summary", async () => {
	const {
		assertJourneyComplete,
		coverageMetricForObservedEvent,
		createTelemetryDeliveryTracker,
		evaluateJourneyCoverage,
		journeyManifest,
		journeyRoutes,
		requiredMetricForObservedEvent,
		sanitizeJourneyFailure,
		sanitizeJourneySummary,
	} = await import("./run-performance-browser-journey.mjs");
	assert.deepEqual(
		{
			schemaVersion: journeyManifest.schemaVersion,
			appId: journeyManifest.appId,
			perRouteEventBudget: journeyManifest.perRouteEventBudget,
			vitalsReadyMark: journeyManifest.vitalsReadyMark,
			vitalsReadyTimeoutMs: journeyManifest.vitalsReadyTimeoutMs,
			representativeInteractionCpuSlowdownRate:
				journeyManifest.representativeInteractionCpuSlowdownRate,
			representativeInteractionSettleFrames:
				journeyManifest.representativeInteractionSettleFrames,
			telemetryAttemptTimeoutMs: journeyManifest.telemetryAttemptTimeoutMs,
			telemetryResponseTimeoutMs: journeyManifest.telemetryResponseTimeoutMs,
			requiredMetrics: journeyManifest.requiredMetrics,
			requiredWeb3Metrics: journeyManifest.requiredWeb3Metrics,
			representativeInteraction: journeyManifest.representativeInteraction,
			safeReadOnlySettles: journeyManifest.safeReadOnlySettles,
			zeroOrObservedMetrics: journeyManifest.zeroOrObservedMetrics,
			healthyZeroMetrics: journeyManifest.healthyZeroMetrics,
			conditionalMetrics: journeyManifest.conditionalMetrics,
			unavailableMetrics: journeyManifest.unavailableMetrics,
		},
		{
			schemaVersion: 2,
			appId: "babysteps",
			perRouteEventBudget: 40,
			vitalsReadyMark: "babysteps.web-vitals.ready",
			vitalsReadyTimeoutMs: 10_000,
			representativeInteractionCpuSlowdownRate: 6,
			representativeInteractionSettleFrames: 2,
			telemetryAttemptTimeoutMs: 3_000,
			telemetryResponseTimeoutMs: 15_000,
			requiredMetrics: [
				"LCP",
				"CLS",
				"INP",
				"FCP",
				"TTFB",
				"navigation.request_wait",
				"navigation.download",
				"navigation.dom_ready",
				"navigation.window_load",
				"resource.fetch.duration",
				"resource.xhr.duration",
				"resource.stylesheet.duration",
				"resource.image.duration",
				"resource.font.duration",
				"resource.script.duration",
				"resource.duration",
				"spa.route.duration",
				"ssr.shell.duration",
				"hydration.duration",
				"contract.read",
				"rpc.read",
				"web3.rpc.read",
				"web3.uniswap.quote",
			],
			requiredWeb3Metrics: [
				"contract.read",
				"rpc.read",
				"web3.rpc.read",
				"web3.uniswap.quote",
			],
			representativeInteraction: {
				route: "/performance",
				expectedMetric: "INP",
				steps: [
					{
						action: "fill",
						role: "textbox",
						name: "页面路径",
						value: "/performance",
					},
					{ action: "click", role: "button", name: "应用筛选" },
					{ action: "click", role: "button", name: "历史快照" },
				],
				assertions: [{ urlSearchParam: "mode", equals: "history" }],
			},
			safeReadOnlySettles: [
				{
					id: "sepolia-marketplace-read",
					route: "/tasks",
					settledRole: "status",
					settledNotText: "正在读取",
					expectedMetrics: ["rpc.read", "web3.rpc.read"],
					safety: "read-only-sepolia",
				},
			],
			zeroOrObservedMetrics: ["longtask.duration"],
			healthyZeroMetrics: [
				"javascript.error",
				"promise.rejection",
				"error.javascript.type_error",
				"error.javascript.network",
				"error.javascript.timeout",
				"error.javascript.unknown",
				"error.promise.type_error",
				"error.promise.network",
				"error.promise.timeout",
				"error.promise.unknown",
				"csr.fallback",
				"hydration.recoverable_error",
			],
			conditionalMetrics: {
				wallet: ["wallet.connect"],
				identity: [
					"web3.privy.login",
					"auth.challenge",
					"auth.sign",
					"auth.verify",
				],
				transaction: [
					"contract.write",
					"web3.uniswap.swap",
					"approve.submit",
					"approve.receipt",
					"transaction.submit",
					"transaction.receipt",
				],
			},
			unavailableMetrics: [
				"navigation.dns",
				"navigation.tcp",
				"navigation.tls",
			],
		},
	);
	assert.equal(
		requiredMetricForObservedEvent({
			type: "web3",
			name: "web3.uniswap.quote.error",
			route: "/exchange",
		}),
		"web3.uniswap.quote",
	);
	assert.equal(
		requiredMetricForObservedEvent({
			type: "web3",
			name: "rpc.read",
			route: "/tasks",
		}),
		"rpc.read",
	);
	assert.equal(
		requiredMetricForObservedEvent({
			type: "web3",
			name: "contract.read",
			route: "/exchange",
		}),
		"contract.read",
	);
	assert.equal(
		coverageMetricForObservedEvent({
			type: "web3",
			name: "rpc.read",
			route: "/exchange",
		}),
		undefined,
		"an exact business metric from the wrong route must fail closed",
	);
	assert.equal(
		coverageMetricForObservedEvent({
			type: "web3",
			name: "web3.uniswap.quote.error",
			route: "/tasks",
		}),
		undefined,
		"a failed business metric from the wrong route must fail closed",
	);
	assert.equal(
		coverageMetricForObservedEvent({
			type: "web-vital",
			name: "LCP",
			route: "/",
		}),
		"LCP",
	);
	for (const contradictory of [
		{
			type: "web3",
			name: "web3.uniswap.quote",
			route: "/exchange",
			outcome: "failure",
		},
		{
			type: "web3",
			name: "web3.uniswap.quote.error",
			route: "/exchange",
			outcome: "success",
		},
	]) {
		assert.equal(
			coverageMetricForObservedEvent(contradictory),
			undefined,
			"a contradictory Web3 name/outcome pair must fail closed",
		);
	}
	for (const event of [
		{ type: "web-vital", name: "LCP.error", route: "/" },
		{
			type: "resource",
			name: "resource.fetch.duration.error",
			route: "/performance",
		},
		{
			type: "web3",
			name: "web3.uniswap.quote.error",
			route: "/tasks",
		},
		{ type: "web3", name: "rpc.read", route: "/exchange" },
		{ type: "web3", name: "contract.read", route: "/tasks" },
	]) {
		assert.equal(
			requiredMetricForObservedEvent(event),
			undefined,
			`${event.name} must not satisfy coverage outside its declared contract`,
		);
	}
	assert.equal(typeof evaluateJourneyCoverage, "function");
	assert.equal(typeof createTelemetryDeliveryTracker, "function");
	assert.ok(
		journeyManifest.telemetryAttemptTimeoutMs * 3 <
			journeyManifest.telemetryResponseTimeoutMs,
		"three transport attempts plus backoff must fit inside the lifecycle drain",
	);
	const required = [
		"LCP",
		"CLS",
		"INP",
		"FCP",
		"TTFB",
		"navigation.request_wait",
		"navigation.download",
		"navigation.dom_ready",
		"navigation.window_load",
		"resource.fetch.duration",
		"resource.xhr.duration",
		"resource.stylesheet.duration",
		"resource.image.duration",
		"resource.font.duration",
		"resource.script.duration",
		"resource.duration",
		"spa.route.duration",
		"ssr.shell.duration",
		"hydration.duration",
		"contract.read",
		"rpc.read",
		"web3.rpc.read",
		"web3.uniswap.quote",
	];
	assert.deepEqual(evaluateJourneyCoverage({ observed: required, required }), {
		complete: true,
		missing: [],
	});
	for (const missing of [
		"CLS",
		"INP",
		"navigation.request_wait",
		"navigation.download",
		"navigation.dom_ready",
		"navigation.window_load",
	]) {
		assert.deepEqual(
			evaluateJourneyCoverage({
				observed: required.filter((name) => name !== missing),
				required,
			}),
			{ complete: false, missing: [missing] },
		);
	}
	assert.deepEqual(
		journeyRoutes.map(({ path, heading }) => [path, heading]),
		[
			["/", "BabySteps · 成长星球"],
			["/tasks", "成长任务市集"],
			["/parent", "家长成长中心"],
			["/keepsakes", "星宝纪念馆"],
			["/provider", "机构与育婴师控制台"],
			["/exchange", "BabyCoin 兑换"],
			["/profile", "个人中心"],
			["/performance", "BabySteps 性能观测站"],
			["/evidence", "链上工作证据"],
		],
	);
	assert.ok(journeyManifest.maxRoutesPerQuotaWindow > 0);
	assert.ok(
		journeyManifest.maxRoutesPerQuotaWindow *
			journeyManifest.perRouteEventBudget <=
			120,
		"each controlled journey window must stay inside the Worker minute quota",
	);
	assert.ok(
		journeyManifest.quotaWindowPauseMs >= 60_000,
		"controlled journey quota windows must be separated by at least one minute",
	);
	const journeySource = await readFile(
		"scripts/run-performance-browser-journey.mjs",
		"utf8",
	);
	assert.match(journeySource, /allowedLocalOrigins/);
	assert.match(
		journeySource,
		/await page\.route\("\*\*\/api\/performance\/events"[\s\S]*if \(dashboardOnly\)[\s\S]*route\.fulfill/,
	);
	assert.match(journeySource, /getByRole\("heading"/);
	assert.match(journeySource, /TELEMETRY_BATCH_REJECTED_/);
	assert.match(journeySource, /performSafeResourceProbes/);
	assert.match(journeySource, /__performance_probe__\/fetch/);
	assert.match(journeySource, /__performance_probe__\/font\.woff2/);
	assert.match(journeySource, /performance-probe-font\.base64/);
	assert.match(
		journeySource,
		/performance\.getEntriesByName\(fontResourceUrl\)/,
		"the font probe must wait for a real Resource Timing entry",
	);
	assert.match(
		journeySource,
		/document\.fonts\.load\([^,]+, "BabySteps"\)/,
		"the font probe must request glyphs from the tracked fixture",
	);
	assert.match(
		journeySource,
		/await waitForPaintSettlement\(page\)/,
		"the representative interaction must keep throttling active through paint",
	);
	assert.match(
		journeySource,
		/requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/,
		"the font probe must give the PerformanceObserver a delivery turn",
	);
	assert.doesNotMatch(journeySource, /backstop_data/);
	const probeFont = Buffer.from(
		(
			await readFile("scripts/fixtures/performance-probe-font.base64", "utf8")
		).trim(),
		"base64",
	);
	assert.equal(probeFont.subarray(0, 4).toString("ascii"), "wOF2");
	assert.match(journeySource, /__performance_probe__\/beacon/);
	assert.match(journeySource, /performSafeBusinessInteractions/);
	assert.match(journeySource, /performSafeReadOnlySettles/);
	assert.match(
		journeySource,
		/for \(const assertion of interaction\.assertions\)/,
	);
	assert.match(journeySource, /requiredMetricForObservedEvent/);
	assert.match(
		journeySource,
		/performSpaNavigation[\s\S]*waitForURL[\s\S]*waitForTimeout\(500\)/,
	);
	assert.match(journeySource, /quotaWindowPauseMs/);
	assert.doesNotMatch(journeySource, /while\s*\([^)]*performance\.now/su);
	assert.match(
		journeySource,
		/journeyManifest\.telemetryResponseTimeoutMs \/ telemetryPollIntervalMs/,
	);
	assert.doesNotMatch(
		journeySource,
		/marketplace-task-card, \.empty-state/,
		"route readiness must not wait for asynchronous Sepolia marketplace data",
	);
	assert.doesNotMatch(journeySource, /keyboard\.press\("Tab"\)/);
	assert.match(
		journeySource,
		/dashboardUrl\.searchParams\.set\("environment", "production"\)/,
	);
	assert.doesNotMatch(
		journeySource,
		/dashboardUrl\.searchParams\.set\("environment", "development"\)/,
	);
	const summary = sanitizeJourneySummary({
		routes: [
			"/",
			"/tasks",
			"/parent",
			"/keepsakes",
			"/provider",
			"/exchange",
			"/profile",
			"/performance",
			"/evidence",
		],
		coverage: [
			...required,
			"longtask.duration",
			"navigation.dns",
			"navigation.tcp",
			"navigation.tls",
		],
		batchCount: 2,
		acceptedBatchCount: 2,
		rejectedBatchCount: 0,
		transportFailureCount: 0,
		eventCount: 14,
		unacceptedEventCount: 0,
		representativeMetricObserved: true,
		safeBusinessOutcomes: {
			"sepolia-uniswap-quote": {
				successObserved: false,
				failureObserved: true,
			},
		},
		privateUrl: "https://private.example/a?token=redacted-fixture",
		cookie: "session=redacted-fixture",
		body: { authorization: "redacted-fixture" },
	});
	assert.deepEqual(summary, {
		routes: [
			"/",
			"/tasks",
			"/parent",
			"/keepsakes",
			"/provider",
			"/exchange",
			"/profile",
			"/performance",
			"/evidence",
		],
		coverage: {
			observed: [...required, "longtask.duration"].sort(),
			unavailable: ["navigation.dns", "navigation.tcp", "navigation.tls"],
			missingRequired: [],
		},
		batchCount: 2,
		acceptedBatchCount: 2,
		rejectedBatchCount: 0,
		transportFailureCount: 0,
		eventCount: 14,
		unacceptedEventCount: 0,
		representativeInteraction: {
			route: "/performance",
			metric: "INP",
			observed: true,
			source: "controlled-browser",
			cpuSlowdownRate: 6,
			paintSettleFrames: 2,
			viewport: { width: 1440, height: 900 },
		},
		safeBusinessInteractions: [
			{
				id: "sepolia-uniswap-quote",
				route: "/exchange",
				metric: "web3.uniswap.quote",
				safety: "read-only-sepolia",
				acceptedOutcomes: ["success", "failure"],
				successObserved: false,
				failureObserved: true,
			},
		],
		zeroOrObserved: [{ name: "longtask.duration", observed: true }],
		healthyZero: {
			expected: [...journeyManifest.healthyZeroMetrics].sort(),
			unexpectedObserved: [],
		},
		lifecycleFinalization: "controlled-browser-hidden-pagehide",
	});
	assert.doesNotThrow(() => assertJourneyComplete(summary));
	for (const [patch, code] of [
		[{ routes: ["/"] }, "INCOMPLETE_BROWSER_ROUTES"],
		[{ eventCount: 0 }, "EMPTY_BROWSER_TELEMETRY"],
		[{ acceptedBatchCount: 0 }, "NO_ACCEPTED_TELEMETRY_BATCH"],
		[
			{ batchCount: 2, acceptedBatchCount: 1, transportFailureCount: 0 },
			"INCOMPLETE_TELEMETRY_RESPONSES",
		],
		[{ unacceptedEventCount: 1 }, "UNACCEPTED_TELEMETRY_EVENTS"],
		[
			{
				representativeInteraction: {
					...summary.representativeInteraction,
					observed: false,
				},
			},
			"MISSING_REPRESENTATIVE_INTERACTION_METRIC",
		],
		[
			{
				safeBusinessInteractions: summary.safeBusinessInteractions.map(
					(interaction) => ({
						...interaction,
						successObserved: false,
						failureObserved: false,
					}),
				),
			},
			"MISSING_SAFE_BUSINESS_INTERACTION_OUTCOME",
		],
		[
			{ coverage: { ...summary.coverage, missingRequired: ["INP"] } },
			"INCOMPLETE_METRIC_COVERAGE",
		],
	]) {
		assert.throws(
			() => assertJourneyComplete({ ...summary, ...patch }),
			new RegExp(code),
		);
	}
	assert.throws(
		() =>
			assertJourneyComplete({
				...summary,
				coverage: {
					...summary.coverage,
					missingRequired: [
						"resource.xhr.duration",
						"resource.stylesheet.duration",
					],
				},
			}),
		{
			message:
				"INCOMPLETE_METRIC_COVERAGE_RESOURCE_STYLESHEET_DURATION_RESOURCE_XHR_DURATION",
		},
	);
	assert.throws(
		() =>
			assertJourneyComplete({
				...summary,
				healthyZero: {
					...summary.healthyZero,
					unexpectedObserved: ["hydration.recoverable_error"],
				},
			}),
		{
			message: "UNHEALTHY_CONTROLLED_JOURNEY_HYDRATION_RECOVERABLE_ERROR",
		},
	);
	assert.throws(
		() =>
			assertJourneyComplete({
				...summary,
				healthyZero: {
					...summary.healthyZero,
					unexpectedObserved: ["javascript.error"],
				},
			}),
		{ message: "UNHEALTHY_CONTROLLED_JOURNEY_JAVASCRIPT_ERROR" },
	);
	assert.doesNotMatch(
		JSON.stringify(summary),
		/secret|private\.example|cookie|authorization/i,
	);
	assert.equal(
		sanitizeJourneyFailure(
			new Error(
				"Timeout at https://private.example/profile?token=redacted-fixture",
			),
			"/profile",
		),
		"ROUTE_TIMEOUT_PROFILE",
	);
	assert.equal(
		sanitizeJourneyFailure(new Error("socket closed"), "/performance"),
		"ROUTE_FAILED_PERFORMANCE",
	);
	assert.doesNotMatch(
		sanitizeJourneyFailure(
			new Error("secret=https://private.example/?token=redacted-fixture"),
			"/evidence",
		),
		/secret|private\.example|token/i,
	);
});

test("the PRD walkthrough records every product route without wallet or chain writes", async () => {
	const source = await readFile(
		"scripts/run-prd-walkthrough-recording.mjs",
		"utf8",
	);
	for (const route of [
		"/",
		"/tasks",
		"/parent",
		"/keepsakes",
		"/provider",
		"/exchange",
		"/profile",
		"/performance?mode=history",
		"/evidence",
	]) {
		assert.match(source, new RegExp(`"${route.replace("?", "\\?")}"`));
	}
	for (const label of [
		"钱包与网络状态",
		"双账本、阶段、活动与冷却",
		"赠送成长星",
		"公开链上便签",
		"抽卡、融合与恢复",
		"Provider、Owner 与完成证书",
		"Uniswap 只读报价",
		"性能与可靠性",
		"要求到证据的可追溯闭环",
	]) {
		assert.match(source, new RegExp(label));
	}
	assert.match(source, /PRD_RECORDING_REQUIRES_LOCAL_ORIGIN/);
	assert.match(source, /COPYFILE_EXCL/);
	assert.match(source, /walletWrites:\s*0/);
	assert.match(source, /chainTransactions:\s*0/);
	assert.match(source, /filter\(\{ hasNotText: "正在" \}\)/);
	assert.match(source, /settledOutcomes/);
	assert.doesNotMatch(
		source,
		/JSON\.stringify\(\{ output: resolve\(output\)/,
		"recording stdout must not expose the local absolute output path",
	);
	assert.doesNotMatch(source, /连接 MetaMask.*click/su);
	assert.doesNotMatch(source, /确认赠送成长星.*click/su);
	assert.doesNotMatch(source, /swapExact|writeContract/);
});

test("the Chromium journey reconciles a transient transport failure by event id", async () => {
	const { createTelemetryDeliveryTracker } = await import(
		"./run-performance-browser-journey.mjs"
	);
	const tracker = createTelemetryDeliveryTracker();
	const batch = {
		events: [
			{ eventId: "event-1", name: "LCP" },
			{ eventId: "event-2", name: "navigation.window_load" },
		],
	};

	const firstAttempt = tracker.beginAttempt(batch);
	tracker.markTransportFailure(firstAttempt);
	assert.equal(tracker.isSettled(), false);

	const retryAttempt = tracker.beginAttempt(batch);
	tracker.markAccepted(retryAttempt);
	assert.equal(tracker.isSettled(), true);
	assert.deepEqual(tracker.snapshot(), {
		batchCount: 2,
		acceptedBatchCount: 1,
		rejectedBatchCount: 0,
		transportFailureCount: 1,
		eventCount: 2,
		unacceptedEventCount: 0,
	});
});

test("the real browser run boots production config and preserves visual Evidence", async () => {
	const source = await readFile(
		".github/workflows/aws-performance.yml",
		"utf8",
	);
	const workflow = parse(source);
	const steps = workflow.jobs["prove-and-clean"].steps;
	const byName = (name) => steps.find((step) => step.name === name);

	assert.match(
		byName("Start local Web at the exact Worker APP_URI origin").run,
		/pnpm --filter @babysteps\/web build/,
	);
	assert.match(
		byName("Start local Web at the exact Worker APP_URI origin").run,
		/pnpm --filter @babysteps\/worker exec wrangler pages dev "\$GITHUB_WORKSPACE\/web\/dist"/,
	);
	assert.doesNotMatch(
		source,
		/pnpm exec wrangler pages dev/,
		"Pages dev must use the workspace package that pins Wrangler",
	);
	assert.equal(
		(
			source.match(
				/pnpm --filter @babysteps\/worker exec wrangler pages dev "\$GITHUB_WORKSPACE\/web\/dist"/gu,
			) ?? []
		).length,
		2,
		"both pre-AWS coverage and cloud Evidence capture must use the pinned Wrangler binary",
	);
	assert.match(
		byName("Start local Web at the exact Worker APP_URI origin").run,
		/VITE_PERFORMANCE_MAX_EVENTS_PER_MINUTE=40/,
	);
	const mainSource = await readFile("web/src/main.tsx", "utf8");
	assert.match(mainSource, /VITE_PERFORMANCE_MAX_EVENTS_PER_MINUTE/);
	assert.match(
		byName("Browser journey through real Chromium").run,
		/--artifacts-dir evidence\/browser/,
	);
	assert.match(
		byName("Capture live performance dashboard Evidence").run,
		/--dashboard-only/,
	);
	assert.match(
		byName("Capture live performance dashboard Evidence").run,
		/--version "\$\{GITHUB_SHA:0:12\}"/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/validate-performance-readback\.mjs\s+\\\s+--stats evidence\/performance-stats\.json/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/ApproximateNumberOfMessagesNotVisible/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/evidence\/queue-after-cleaner\.json/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/test "\$queue_total" = "0"/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/test "\$dlq_visible" = "0"/,
	);
	assert.doesNotMatch(
		byName("Query and verify real browser aggregates").run,
		/if\(samples<1\)/,
	);
	assert.match(
		byName("Query and verify real browser aggregates").run,
		/environment=production/,
	);
	assert.doesNotMatch(
		byName("Query and verify real browser aggregates").run,
		/environment=development/,
	);
	assert.match(
		byName("Capture real control-plane snapshot before cleanup").run,
		/OutputKey=='ApiEndpoint'/,
	);
	assert.doesNotMatch(
		byName("Capture real control-plane snapshot before cleanup").run,
		/cloudformation describe-stack-resource/,
	);
	const controlPlaneReadback = byName(
		"Capture real control-plane snapshot before cleanup",
	).run;
	assert.match(controlPlaneReadback, /lambda list-functions/);
	assert.match(controlPlaneReadback, /secretsmanager list-secrets/);
	assert.match(controlPlaneReadback, /iam list-roles/);
	assert.doesNotMatch(controlPlaneReadback, /lambda get-function/);
	assert.doesNotMatch(controlPlaneReadback, /secretsmanager describe-secret/);
	assert.doesNotMatch(controlPlaneReadback, /iam get-role/);
	assert.match(controlPlaneReadback, /fs\.existsSync\(cleanerSummaryPath\)/);
	const upload = steps.find(
		(step) => step.uses === "actions/upload-artifact@v4",
	);
	assert.equal(upload.with.path, "evidence/");
	assert.equal(upload.with["if-no-files-found"], "error");
});

test("conditional wallet, identity, RPC and transaction scenarios have real instrumentation owners", async () => {
	const owners = [
		["web/src/components/WalletPanel.tsx", "wallet.connect"],
		["web/src/features/identity/PrivyIdentityPanel.tsx", "web3.privy.login"],
		["web/src/features/identity/identityApi.ts", "auth.challenge"],
		["web/src/features/identity/identityApi.ts", "auth.sign"],
		["web/src/features/identity/identityApi.ts", "auth.verify"],
		["web/src/config/wagmi.ts", "rpc.read"],
		["web/src/config/wagmi.ts", "web3.rpc.read"],
		["web/src/features/exchange/useUniswapSwap.ts", "contract.read"],
		["web/src/features/exchange/useUniswapSwap.ts", "contract.write"],
		["web/src/features/exchange/useUniswapSwap.ts", "approve.submit"],
		["web/src/features/exchange/useUniswapSwap.ts", "approve.receipt"],
		["web/src/features/exchange/useUniswapSwap.ts", "transaction.submit"],
		["web/src/features/exchange/useUniswapSwap.ts", "transaction.receipt"],
	];
	for (const [path, metric] of owners) {
		assert.match(
			await readFile(path, "utf8"),
			new RegExp(metric.replaceAll(".", "\\.")),
			`${metric} is missing its real product instrumentation owner`,
		);
	}
	const exchangeSource = await readFile(
		"web/src/features/exchange/useUniswapSwap.ts",
		"utf8",
	);
	assert.match(
		exchangeSource,
		/catch \(error\) \{[\s\S]*setMessage\(toWalletMessage\(error\)\);[\s\S]*throw error;[\s\S]*\}\)\.catch\(\(\) => undefined\)/,
		"swap failures must reach the outer metric before the UI swallows rejection",
	);
});

test("performance readback rejects partial metric coverage", async () => {
	const { validatePerformanceReadback } = await import(
		"./validate-performance-readback.mjs"
	);
	const manifest = JSON.parse(
		await readFile("scripts/performance-journey.manifest.json", "utf8"),
	);
	const conditionalMetrics = Object.values(manifest.conditionalMetrics).flat();
	const renderingHealthyZeroMetrics = new Set([
		"csr.fallback",
		"hydration.recoverable_error",
	]);
	const errorMetrics = manifest.healthyZeroMetrics.filter(
		(name) => !renderingHealthyZeroMetrics.has(name),
	);
	const minLatestSampleAt = 1_900;
	const expectedVersion = "abcdef123456";
	const expectations = {
		expectedVersion,
		expectedEnvironment: "production",
		expectedWindow: "1h",
		minLatestSampleAt,
		requiredRoutes: manifest.routes.map(({ path }) => path),
		maxObservedAt: 2_100,
	};
	const stats = {
		window: "1h",
		filters: {
			window: "1h",
			environment: "production",
			version: expectedVersion,
		},
		freshness: {
			observedAt: 2_000,
			latestSampleAt: 1_950,
			mode: "live",
			source: "live-api",
			runId: null,
			commit: null,
		},
		versions: [
			{
				version: expectedVersion,
				sampleCount: 1,
				p75: 1,
				p95: 1,
			},
		],
		observedRoutes: manifest.routes.map(({ path }) => ({
			route: path,
			sampleCount: 1,
			latestSampleAt: 1_950,
		})),
		vitals: ["LCP", "CLS", "INP", "FCP", "TTFB"].map((name) => ({
			name,
			unit: name === "CLS" ? "score" : "ms",
			sampleCount: 1,
			p50: 1,
			p75: 1,
			p95: 1,
			coverage: "observed",
		})),
		navigation: [
			...[
				"navigation.request_wait",
				"navigation.download",
				"navigation.dom_ready",
				"navigation.window_load",
			].map((name) => ({
				name,
				unit: "ms",
				sampleCount: 1,
				p50: 1,
				p75: 1,
				p95: 1,
				coverage: "observed",
			})),
			...manifest.unavailableMetrics.map((name) => ({
				name,
				unit: "ms",
				sampleCount: 0,
				p50: null,
				p75: null,
				p95: null,
				coverage: "unavailable",
			})),
		],
		resources: [
			"resource.fetch.duration",
			"resource.xhr.duration",
			"resource.stylesheet.duration",
			"resource.image.duration",
			"resource.font.duration",
			"resource.script.duration",
			"resource.duration",
		].map((name) => ({
			name,
			unit: "ms",
			sampleCount: 1,
			p50: 1,
			p75: 1,
			p95: 1,
			coverage: "observed",
		})),
		rendering: [
			"spa.route.duration",
			"ssr.shell.duration",
			"hydration.duration",
		].map((name) => ({
			name,
			unit: "ms",
			sampleCount: 1,
			p50: 1,
			p75: 1,
			p95: 1,
			coverage: "observed",
		})),
		longTasks: {
			count: 1,
			totalDurationMs: 75,
			maxDurationMs: 75,
			duration: {
				name: "longtask.duration",
				unit: "ms",
				sampleCount: 1,
				p50: 75,
				p75: 75,
				p95: 75,
				coverage: "observed",
			},
			coverage: "observed",
		},
		web3: manifest.requiredWeb3Metrics.map((name, index) => {
			const successCount = index % 2 === 0 ? 1 : 0;
			const failureCount = successCount === 1 ? 0 : 1;
			return {
				name,
				unit: "ms",
				sampleCount: 1,
				successCount,
				failureCount,
				successRate: successCount,
				p50: 1,
				p75: 1,
				p95: 1,
				coverage: "observed",
			};
		}),
		errors: errorMetrics.map((name) => ({
			name,
			sampleCount: 0,
			rate: 0,
			coverage: "observed-zero",
		})),
		coverage: [
			...["spa.route.duration", "ssr.shell.duration", "hydration.duration"].map(
				(name) => ({ name, status: "observed" }),
			),
			...manifest.requiredWeb3Metrics.map((name) => ({
				name,
				status: "observed",
			})),
			...manifest.healthyZeroMetrics.map((name) => ({
				name,
				status: "observed-zero",
			})),
			...conditionalMetrics.map((name) => ({
				name,
				status: "not-exercised",
			})),
			...manifest.unavailableMetrics.map((name) => ({
				name,
				status: "unavailable",
			})),
		],
	};
	assert.deepEqual(validatePerformanceReadback(stats, expectations), {
		observedRouteCount: 9,
		navigationSampleCount: 4,
		vitalSampleCount: 5,
		resourceSampleCount: 7,
		longTaskSampleCount: 1,
		web3SampleCount: 4,
		web3SuccessCount: 2,
		web3FailureCount: 2,
		renderingSampleCount: 3,
		healthyZeroCount: 12,
		conditionalNotExercisedCount: 11,
		unavailableCount: 3,
	});
	for (const [patch, error] of [
		[
			{ filters: { ...stats.filters, version: "wrong-version" } },
			/READBACK_VERSION_FILTER_MISMATCH/,
		],
		[
			{ filters: { ...stats.filters, environment: "staging" } },
			/READBACK_ENVIRONMENT_MISMATCH/,
		],
		[{ window: "24h" }, /READBACK_WINDOW_MISMATCH/],
		[
			{
				freshness: { ...stats.freshness, latestSampleAt: 1_899 },
			},
			/READBACK_FRESHNESS_MISMATCH/,
		],
		[
			{
				observedRoutes: stats.observedRoutes.filter(
					({ route }) => route !== "/exchange",
				),
			},
			/READBACK_ROUTE_MISSING_\/exchange/,
		],
	]) {
		assert.throws(
			() => validatePerformanceReadback({ ...stats, ...patch }, expectations),
			error,
		);
	}
	for (const [section, missing] of [
		["vitals", "CLS"],
		["vitals", "INP"],
		["navigation", "navigation.request_wait"],
		["navigation", "navigation.window_load"],
		["resources", "resource.fetch.duration"],
		["resources", "resource.image.duration"],
		["resources", "resource.script.duration"],
		["rendering", "hydration.duration"],
		["web3", "contract.read"],
		["web3", "rpc.read"],
		["web3", "web3.rpc.read"],
		["web3", "web3.uniswap.quote"],
	]) {
		assert.throws(
			() =>
				validatePerformanceReadback({
					...stats,
					[section]: stats[section].filter(({ name }) => name !== missing),
				}),
			new RegExp(`MISSING_REQUIRED_SAMPLE_${missing.replaceAll(".", "_")}`),
		);
	}
	assert.throws(
		() =>
			validatePerformanceReadback({
				...stats,
				coverage: stats.coverage.filter(
					({ name }) => name !== "hydration.duration",
				),
			}),
		/MISSING_REQUIRED_COVERAGE_hydration_duration/,
	);
	assert.deepEqual(
		validatePerformanceReadback({
			...stats,
			longTasks: {
				count: 0,
				totalDurationMs: 0,
				maxDurationMs: null,
				duration: {
					name: "longtask.duration",
					unit: "ms",
					sampleCount: 0,
					p50: null,
					p75: null,
					p95: null,
					coverage: "observed-zero",
				},
				coverage: "observed-zero",
			},
		}),
		{
			navigationSampleCount: 4,
			vitalSampleCount: 5,
			resourceSampleCount: 7,
			longTaskSampleCount: 0,
			web3SampleCount: 4,
			web3SuccessCount: 2,
			web3FailureCount: 2,
			renderingSampleCount: 3,
			healthyZeroCount: 12,
			conditionalNotExercisedCount: 11,
			unavailableCount: 3,
		},
	);
	assert.throws(
		() =>
			validatePerformanceReadback({
				...stats,
				web3: stats.web3.map((metric) =>
					metric.name === "web3.uniswap.quote"
						? { ...metric, successCount: 1 }
						: metric,
				),
			}),
		/INVALID_REQUIRED_OUTCOME_COUNTS_web3_uniswap_quote/,
	);
	assert.throws(
		() =>
			validatePerformanceReadback({
				...stats,
				vitals: stats.vitals.map((metric) =>
					metric.name === "LCP" ? { ...metric, sampleCount: 0 } : metric,
				),
			}),
		/MISSING_REQUIRED_SAMPLE_LCP/,
	);
	for (const [patch, error] of [
		[{ unit: "count" }, /INVALID_REQUIRED_UNIT_LCP/],
		[{ p75: null }, /INVALID_REQUIRED_PERCENTILES_LCP/],
		[{ coverage: "instrumented-no-sample" }, /INVALID_REQUIRED_COVERAGE_LCP/],
	]) {
		assert.throws(
			() =>
				validatePerformanceReadback({
					...stats,
					vitals: stats.vitals.map((metric) =>
						metric.name === "LCP" ? { ...metric, ...patch } : metric,
					),
				}),
			error,
		);
	}
	for (const [name, status, error] of [
		["javascript.error", "instrumented-no-sample", /INVALID_HEALTHY_ZERO/],
		["wallet.connect", "observed", /INVALID_CONDITIONAL_COVERAGE/],
		["navigation.dns", "observed", /INVALID_UNAVAILABLE_COVERAGE/],
	]) {
		assert.throws(
			() =>
				validatePerformanceReadback({
					...stats,
					coverage: stats.coverage.map((item) =>
						item.name === name ? { ...item, status } : item,
					),
				}),
			error,
		);
	}
});

test("the pipeline validator follows the manifest-driven metric contract", async () => {
	const source = await readFile(
		"scripts/validate-performance-pipeline.mjs",
		"utf8",
	);

	assert.match(source, /performance-journey\.manifest\.json/);
	assert.match(source, /validate-performance-readback\.mjs/);
	assert.match(source, /requiredMetrics/);
	assert.match(source, /unavailableMetrics/);
	assert.doesNotMatch(source, /"sampleCount"/);
});

test("ephemeral Evidence lifecycle permissions stay inside the run prefix", async () => {
	const policy = JSON.parse(
		await readFile(
			"aws/iam/performance-evidence-lifecycle-policy.json",
			"utf8",
		),
	);
	const list = policy.Statement.find((statement) =>
		(Array.isArray(statement.Action)
			? statement.Action
			: [statement.Action]
		).includes("ecs:ListTasks"),
	);
	assert.equal(list.Effect, "Allow");
	assert.equal(list.Resource, "*");
	assert.equal(list.Condition.StringEquals["aws:RequestedRegion"], "us-east-1");
	assert.equal(
		list.Condition.ArnLike["ecs:cluster"],
		"arn:aws:ecs:us-east-1:782086108248:cluster/babysteps-performance-e*",
	);

	const remove = policy.Statement.find((statement) =>
		(Array.isArray(statement.Action)
			? statement.Action
			: [statement.Action]
		).includes("ecs:DeleteTaskDefinitions"),
	);
	assert.equal(remove.Effect, "Allow");
	assert.deepEqual(remove.Resource, [
		"arn:aws:ecs:us-east-1:782086108248:task-definition/babysteps-performance-cleaner-e*:*",
		"arn:aws:ecs:us-east-1:782086108248:task-definition/babysteps-performance-db-admin-e*:*",
	]);
	assert.equal(
		remove.Condition.StringEquals["aws:RequestedRegion"],
		"us-east-1",
	);
	assert.deepEqual(
		new Set(
			policy.Statement.flatMap((statement) =>
				Array.isArray(statement.Action) ? statement.Action : [statement.Action],
			),
		),
		new Set(["ecs:DeleteTaskDefinitions", "ecs:ListTasks"]),
	);
});

test("the production cleaner bundle boots under Node without an ESM dynamic-require crash", async () => {
	const packageJson = JSON.parse(await readFile("aws/package.json", "utf8"));
	const buildScript = packageJson.scripts["build:performance:cleaner"];
	const output = buildScript.match(/--outfile=([^\s]+)/)?.[1];
	assert.ok(output, "cleaner build must declare an output file");

	execFileSync(
		"pnpm",
		["--filter", "@babysteps/aws", "build:performance:cleaner"],
		{
			stdio: "pipe",
		},
	);
	const boot = spawnSync(process.execPath, [`aws/${output}`], {
		encoding: "utf8",
		env: { PATH: process.env.PATH, PERFORMANCE_RUN_ID: "123" },
	});

	assert.doesNotMatch(
		boot.stderr,
		/Dynamic require of "node:https" is not supported/,
	);
	assert.match(boot.stderr, /MISSING_QUEUE_URL/);
});

test("a manual OIDC recovery gate can remove only an exact failed performance stack", async () => {
	const recovery = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	).catch(() => "");
	const workflow = parse(recovery);
	assert.ok(workflow);
	const steps = workflow.jobs["recover-exact-stack"].steps;
	for (const step of steps) {
		assert.doesNotMatch(
			step.run ?? "",
			/\$\{\{\s*inputs\./,
			`${step.name ?? "unnamed step"} interpolates an untrusted input into shell`,
		);
	}
	const stepByName = (name) => steps.find((step) => step.name === name);
	const validation = stepByName(
		"Validate exact recovery target and capture sanitized state",
	);
	assert.equal(validation.id, "validate-target");
	assert.match(validation.run, /Project/);
	assert.match(validation.run, /RunId/);
	assert.match(validation.run, /test "\$project" = "babysteps-performance"/);
	assert.match(validation.run, /test "\$tagged_run_id" = "\$run_id"/);
	assert.match(validation.run, /validated=true.*GITHUB_OUTPUT/s);
	assert.match(validation.run, /stack_state=.*GITHUB_OUTPUT/s);

	assert.match(
		stepByName("Drop and verify exact run-scoped schema").if,
		/^always\(\)/,
	);
	assert.match(
		stepByName("Drop and verify exact run-scoped schema").if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		stepByName("Drop and verify exact run-scoped schema").if,
		/steps\.validate-target\.outputs\.stack_state == 'present'/,
	);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/schema-cleanup\.outcome == 'success'/,
	);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/database_state != 'schema-initialized'/,
	);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		stepByName("Delete exact failed project stack").if,
		/steps\.validate-target\.outputs\.stack_state == 'present'/,
	);
	const orphanedTaskDefinitions = stepByName(
		"Delete exact orphaned task definitions",
	);
	assert.equal(orphanedTaskDefinitions.id, "delete-task-definitions");
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.validate-target\.outcome == 'success'/,
	);
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.validate-target\.outputs\.validated == 'true'/,
	);
	assert.match(orphanedTaskDefinitions.if, /outputs\.stack_state == 'absent'/);
	assert.match(
		orphanedTaskDefinitions.if,
		/steps\.delete-stack\.outcome == 'success'/,
	);
	assert.match(
		orphanedTaskDefinitions.run,
		/babysteps-performance-cleaner-\$ENVIRONMENT_NAME/,
	);
	assert.match(
		orphanedTaskDefinitions.run,
		/babysteps-performance-db-admin-\$ENVIRONMENT_NAME/,
	);
	assert.match(
		orphanedTaskDefinitions.run,
		/test "\$actual_family" = "\$family"/,
	);
	const inventory = stepByName("Verify exact prefix and tag inventory is zero");
	assert.match(inventory.if, /steps\.validate-target\.outcome == 'success'/);
	assert.match(inventory.if, /outputs\.stack_state == 'absent'/);
	assert.match(
		inventory.if,
		/steps\.delete-task-definitions\.outcome == 'success'/,
	);
	assert.equal(
		inventory.run.match(
			/ecs_task_remaining=\$\(\(ecs_task_remaining \+ count\)\)/g,
		)?.length,
		1,
		"each ECS task count must be accumulated exactly once",
	);

	const awsWritePattern =
		/aws (?:ecs run-task|cloudformation delete-stack|ecs delete-task-definitions)\b/;
	const writeSteps = steps.filter((step) =>
		awsWritePattern.test(step.run ?? ""),
	);
	assert.ok(writeSteps.length >= 2);
	for (const step of writeSteps) {
		assert.match(
			step.if ?? "",
			/steps\.validate-target\.outcome == 'success'/,
			`${step.name} can write AWS state after target validation failed`,
		);
		assert.match(
			step.if ?? "",
			/steps\.validate-target\.outputs\.validated == 'true'/,
			`${step.name} can write AWS state without the validated target output`,
		);
		if (
			/aws (?:ecs run-task|cloudformation delete-stack)\b/.test(step.run ?? "")
		) {
			assert.match(
				step.if ?? "",
				/steps\.validate-target\.outputs\.stack_state == 'present'/,
				`${step.name} can write stack-owned AWS state for an absent stack`,
			);
		}
	}
	assert.doesNotMatch(validation.run, awsWritePattern);
	assert.match(
		recovery,
		/APPROVAL_REFERENCE:\s*\$\{\{ inputs\.approval_reference \}\}/,
	);
	assert.match(recovery, /ecs list-tasks/);
	assert.match(recovery, /workflow_dispatch:/);
	assert.match(recovery, /environment: aws-performance/);
	assert.match(recovery, /id-token: write/);
	assert.match(recovery, /\^babysteps-performance-\[0-9\]\+\$/);
	assert.match(recovery, /if aws cloudformation describe-stacks/);
	assert.match(recovery, /delete-stack --stack-name "\$STACK_NAME"/);
	assert.match(recovery, /stack-delete-complete/);
	assert.match(recovery, /sqs get-queue-url --queue-name/);
	assert.match(recovery, /lambda list-functions/);
	assert.match(recovery, /apigatewayv2 get-apis/);
	assert.match(recovery, /secretsmanager list-secrets/);
	assert.match(recovery, /logs describe-log-groups/);
	assert.match(recovery, /ec2 describe-security-groups/);
	assert.match(recovery, /iam list-roles/);
	assert.match(recovery, /ecs describe-task-definition --task-definition/);
	assert.match(recovery, /cloudFormationStackAbsent.*true/);
	assert.match(recovery, /remainingProjectResources/);
	assert.match(recovery, /test "\$remaining" = "0"/);
	assert.match(recovery, /shared.*(?:explicit deny|protected)/is);
	assert.match(recovery, /cleanup_required/);
	for (const logGroup of [
		"/babysteps/performance/$ENVIRONMENT_NAME",
		"/aws/lambda/babysteps-performance-ingest-$ENVIRONMENT_NAME",
		"/aws/lambda/babysteps-performance-query-$ENVIRONMENT_NAME",
	]) {
		assert.ok(
			recovery.includes(logGroup),
			`recovery inventory is missing ${logGroup}`,
		);
	}
	assert.doesNotMatch(recovery, /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)/);
});

test("every SAM deploy supplies the required run and approval hash parameters", async () => {
	for (const workflowPath of [
		".github/workflows/aws-performance.yml",
		".github/workflows/aws-performance-control.yml",
	]) {
		const workflow = parse(await readFile(workflowPath, "utf8"));
		const deploys = Object.values(workflow.jobs).flatMap((job) =>
			(job.steps ?? []).filter((step) => /\bsam deploy\b/.test(step.run ?? "")),
		);
		assert.ok(deploys.length > 0, `${workflowPath} must deploy through SAM`);
		for (const deploy of deploys) {
			assert.match(deploy.run, /RunId="\$RUN_ID"/);
			assert.match(
				deploy.run,
				/ApprovalReferenceHash="\$APPROVAL_REFERENCE_HASH"/,
			);
		}
	}
});

test("a scheduled TTL janitor dispatches the existing exact recovery deep module", async () => {
	const source = await readFile(
		".github/workflows/aws-performance-recovery.yml",
		"utf8",
	);
	const workflow = parse(source);
	assert.match(JSON.stringify(workflow.on.schedule), /\*\/15 \* \* \* \*/);
	const janitor = workflow.jobs["dispatch-expired-recovery"];
	assert.equal(janitor.if, "github.event_name == 'schedule'");
	assert.equal(janitor.permissions.actions, "write");
	assert.equal(janitor.permissions["id-token"], "write");
	const run = janitor.steps.find(
		(step) => step.name === "Dispatch one exact expired recovery",
	).run;
	assert.match(run, /gh run list/);
	assert.match(run, /databaseId/);
	assert.match(run, /--arg current "\$GITHUB_RUN_ID"/);
	assert.match(run, /databaseId\s*\|\s*tostring/);
	assert.match(run, /babysteps-performance-\[0-9\]\+/);
	assert.match(run, /Project/);
	assert.match(run, /RunId/);
	assert.match(run, /ExpiresAt/);
	assert.match(run, /aws-performance-recovery\.yml/);
	assert.match(run, /database_state=schema-initialized/);
	assert.doesNotMatch(
		run,
		/cloudformation (?:delete-stack|update-stack|create-stack)/,
	);
	assert.doesNotMatch(run, /ecs run-task/);
});
test("the browser journey installs Chromium with runner dependencies", async () => {
	const { readFile } = await import("node:fs/promises");
	const workflow = await readFile(
		new URL("../.github/workflows/aws-performance.yml", import.meta.url),
		"utf8",
	);

	assert.match(workflow, /pnpm exec playwright install --with-deps chromium/);
	assert.doesNotMatch(workflow, /pnpm exec playwright install chromium/);
});
