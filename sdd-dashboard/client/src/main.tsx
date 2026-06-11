/**
 * エントリ: QueryClient + Router の組み立て（design.md File Structure Plan）。
 * SseInvalidationBridge の接続はタスク 9.x で追加する。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { createQueryClient } from "@/app/queryClient";
import { createAppRouter } from "@/app/router";
import "@/index.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("ルート要素 #root が index.html に存在しません");
}

const queryClient = createQueryClient();
const router = createAppRouter();

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
