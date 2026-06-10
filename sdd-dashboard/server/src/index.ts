/**
 * sdd-core サーバーのエントリポイント。
 * CLI 引数解決 → RepoContext 生成 → HTTP サーバー起動・終了制御を担う。
 * パス・ポートの定義は config.ts（RepoContext）に集約し、ここでは保持しない。
 * ルート定義は暫定（タスク 8.3 で HonoApp 本実装に置き換える）。
 */
import { serve, type ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { pathToFileURL } from "node:url";
import { createRepoContext, type RepoContext } from "./config.js";

export const PACKAGE_NAME = "sdd-core-server" as const;

export type ParsedArgs =
  | { readonly ok: true; readonly repoPath: string; readonly port: number | undefined }
  | { readonly ok: false; readonly message: string };

const USAGE = "usage: sdd-core-server <repository path> [--port <number>]";

/** CLI 引数を解釈する（位置引数 = リポジトリパス、`--port <number>` = 待受ポート）。 */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  let repoPath: string | undefined;
  let port: number | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") {
      const value = argv[i + 1];
      if (value === undefined || !/^\d+$/.test(value)) {
        return { ok: false, message: `invalid --port value: ${value ?? "(missing)"}\n${USAGE}` };
      }
      port = Number(value);
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--")) {
      return { ok: false, message: `unknown option: ${arg}\n${USAGE}` };
    } else if (repoPath === undefined && arg !== undefined) {
      repoPath = arg;
    } else {
      return { ok: false, message: `unexpected argument: ${arg ?? ""}\n${USAGE}` };
    }
  }
  if (repoPath === undefined) {
    return { ok: false, message: `repository path argument is required\n${USAGE}` };
  }
  return { ok: true, repoPath, port };
}

export interface ServerHandle {
  readonly server: ServerType;
  /** 実際に待ち受けているポート（port 0 指定時は OS 割り当て値） */
  readonly port: number;
  readonly close: () => Promise<void>;
}

/** 暫定ルートで HTTP サーバーを localhost に起動する（タスク 8.3 で全ルートに置き換え）。 */
export function startServer(context: RepoContext): Promise<ServerHandle> {
  const app = new Hono();
  app.get("/api/health", (c) =>
    c.json({ status: "ok", name: PACKAGE_NAME, repoRoot: context.repoRoot }),
  );
  return new Promise((resolvePromise, rejectPromise) => {
    const server = serve(
      { fetch: app.fetch, hostname: "127.0.0.1", port: context.port },
      (info) => {
        resolvePromise({
          server,
          port: info.port,
          close: () =>
            new Promise<void>((resolveClose, rejectClose) => {
              server.close((error) => (error ? rejectClose(error) : resolveClose()));
            }),
        });
      },
    );
    server.once("error", rejectPromise);
  });
}

export interface CliIo {
  readonly stderr: (line: string) => void;
  readonly stdout: (line: string) => void;
}

export type RunCliResult =
  | { readonly kind: "error"; readonly exitCode: number }
  | {
      readonly kind: "running";
      readonly context: RepoContext;
      readonly port: number;
      readonly close: () => Promise<void>;
    };

/**
 * エントリ本体: 引数解決 → RepoContext 生成 → サーバー起動。
 * 不正引数・不正パスでは exit code 1 相当の結果を返す（process.exit は wiring 側のみ）。
 */
export async function runCli(
  argv: readonly string[],
  io: CliIo = { stderr: console.error, stdout: console.log },
): Promise<RunCliResult> {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    io.stderr(parsed.message);
    return { kind: "error", exitCode: 1 };
  }
  const result = createRepoContext(parsed.repoPath, parsed.port);
  if (!result.ok) {
    io.stderr(result.message);
    return { kind: "error", exitCode: 1 };
  }
  try {
    const handle = await startServer(result.context);
    io.stdout(
      `[${PACKAGE_NAME}] listening on http://127.0.0.1:${handle.port} (repo: ${result.context.repoRoot})`,
    );
    return { kind: "running", context: result.context, port: handle.port, close: handle.close };
  } catch (error) {
    io.stderr(`failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    return { kind: "error", exitCode: 1 };
  }
}

const isDirectRun =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  const result = await runCli(process.argv.slice(2));
  if (result.kind === "error") {
    process.exit(result.exitCode);
  }
}
