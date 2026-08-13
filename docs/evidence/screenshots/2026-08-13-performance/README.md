# Performance observability visual evidence

Captured from the local production Web build on 2026-08-13.

- `performance-dashboard-desktop-1920.png`: 1920px dashboard; honest upstream-unavailable state and five filters. Look for “无演示数据兜底”. It proves the UI does not fabricate cloud statistics before AWS verification.
- `performance-dashboard-mobile-390.png`: 390px dashboard. It proves filters and the honest error state remain readable with no root horizontal overflow.
- `evidence-performance-desktop-1920.png`: full desktop Evidence page after both performance SVGs loaded at their real 2400×1600 dimensions.
- `evidence-performance-mobile-390.png`: full 390px Evidence page. It proves the case study remains single-column and readable.
- `evidence-performance-diagrams-mobile-390.png`: mobile viewport focused on the performance diagram section after lazy loading.

These files prove local layout and truthful status only. They do not prove AWS deployment. Cloud resource IDs, controlled event statistics and cleanup results must come from the GitHub Actions artifact.
