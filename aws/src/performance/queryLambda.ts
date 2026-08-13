import { createPerformanceQueryHandler } from "./handlers";
import { createPerformancePool, required } from "./runtime";
import { PostgresPerformanceStore } from "./storage";

let storePromise: Promise<PostgresPerformanceStore> | undefined;
function store() {
	storePromise ??= createPerformancePool().then(
		(pool) => new PostgresPerformanceStore(pool),
	);
	return storePromise;
}

export const handler = createPerformanceQueryHandler({
	originToken: required("ORIGIN_TOKEN"),
	query: async (filters) => (await store()).query(filters),
});
