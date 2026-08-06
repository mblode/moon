import { createRoot } from "react-dom/client";

import App from "./app";

// styles.css is linked from index.html, not imported here, so the static markup
// outside #root is styled before first paint in dev as well as in the build.

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
