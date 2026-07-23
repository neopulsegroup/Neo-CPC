import { createRoot } from "react-dom/client";
import { applyNewBuildCachePolicy } from "@/lib/appBuildCache";
import { clearDevAppDataCaches, shouldDisableAppCaches } from "@/lib/devNoCache";
import App from "./App.tsx";
import "./index.css";

if (shouldDisableAppCaches()) {
  clearDevAppDataCaches();
}

// Nova implementação → limpa caches obsoletos antes de montar a app.
if (!applyNewBuildCachePolicy()) {
  createRoot(document.getElementById("root")!).render(<App />);
}