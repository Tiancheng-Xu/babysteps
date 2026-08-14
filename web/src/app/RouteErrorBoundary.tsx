import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class RouteErrorBoundary extends Component<Props, State> {
	state: State = { failed: false };

	static getDerivedStateFromError(): State {
		return { failed: true };
	}

	componentDidCatch(_error: unknown, _info: ErrorInfo) {
		// Rendering errors are reported by the global performance client.
		// Never include component props, wallet state, or user data in logs.
	}

	private retry = () => {
		this.setState({ failed: false });
	};

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<section className="story-card" aria-labelledby="route-error-heading">
				<p className="eyebrow">页面暂时没有完成加载</p>
				<h1 id="route-error-heading">互动区域遇到了问题</h1>
				<p>公开内容仍可阅读。你可以重试当前页面，未确认的交易不会自动发送。</p>
				<button
					className="button button--primary"
					type="button"
					onClick={this.retry}
				>
					重新加载互动区域
				</button>
			</section>
		);
	}
}
