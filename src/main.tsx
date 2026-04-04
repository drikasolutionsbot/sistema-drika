import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global safety: prevent unhandled promise rejections from leaving stuck overlays
window.addEventListener("unhandledrejection", () => {
  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
});

// Global safety: catch uncaught errors
window.addEventListener("error", () => {
  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
});

createRoot(document.getElementById("root")!).render(<App />);
