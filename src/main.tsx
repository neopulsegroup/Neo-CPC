import { createRoot } from "react-dom/client";
import { applyNewBuildCachePolicy } from "@/lib/appBuildCache";
import App from "./App.tsx";
import "./index.css";

// Nova implementação → limpa caches obsoletos antes de montar a app.
if (!applyNewBuildCachePolicy()) {
  createRoot(document.getElementById("root")!).render(<App />);
}