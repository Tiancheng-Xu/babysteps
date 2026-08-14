import { BrowserRouter } from "react-router-dom";

import { AppRoutes } from "./routing/routes";

export default function App({ interactive = true }: { interactive?: boolean }) {
	return (
		<BrowserRouter>
			<AppRoutes interactive={interactive} />
		</BrowserRouter>
	);
}
