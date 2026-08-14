import { renderToReadableStream } from "react-dom/server.edge";
import { StaticRouter } from "react-router-dom";

import { ServerAppRoutes } from "./routing/serverRoutes";

export async function renderRouteStream(
	pathname: string,
	signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
	return renderToReadableStream(
		<StaticRouter location={pathname}>
			<ServerAppRoutes />
		</StaticRouter>,
		{
			signal,
			onError(error) {
				const name = error instanceof Error ? error.name : "RenderError";
				return `babysteps-${name}`;
			},
		},
	);
}
