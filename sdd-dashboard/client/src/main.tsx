import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "@/index.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("ルート要素 #root が index.html に存在しません");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
