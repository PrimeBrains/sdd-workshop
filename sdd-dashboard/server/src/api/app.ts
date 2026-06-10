/**
 * HonoApp — アプリ組み立て・CORS(localhost)・エラーミドルウェア
 * （design.md API 層 HonoApp + Routes。Requirements 1.5, 13.1, 13.4）。
 *
 * - CORS は `http://localhost[:port]` / `http://127.0.0.1[:port]` オリジンのみ許可（1.5）。
 *   許可外オリジンには Access-Control-Allow-Origin を付与せず、ブラウザ側で拒否させる
 *   （標準 CORS 意味論。サーバー自体も 127.0.0.1 バインドで非ローカル到達を遮断する）
 * - エラーミドルウェア（onError）: AppError → ERROR_HTTP_STATUS + ApiError JSON
 *   （details.fieldErrors → error.fieldErrors、11.4）、未知例外 → 500 INTERNAL_ERROR。
 *   いずれもプロセスは継続する（13.1, 13.4）
 * - ルート・サービスの本配線（readValidations seam を含む）はここが唯一の組み立て点。
 *   watcher の起動・終了は index.ts（エントリ層）の責務
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RepoContext } from "../config.js";
import { AppError, ERROR_HTTP_STATUS, ErrorCode } from "../errors/codes.js";
import { createAdrService } from "../services/adr-service.js";
import { createKiroScanner } from "../services/kiro-scanner.js";
import { createSkillService } from "../services/skill-service.js";
import { createSpecService } from "../services/spec-service.js";
import { createSteeringService } from "../services/steering-service.js";
import { createValidationService } from "../services/validation-service.js";
import { createAdrWriter } from "../services/writes/adr-writer.js";
import { createApprovalWriter } from "../services/writes/approval-writer.js";
import { createAuditLog, type AuditSink } from "../services/writes/audit-log.js";
import { createRollbackWriter } from "../services/writes/rollback-writer.js";
import { createSafePathGuard } from "../services/writes/safe-path.js";
import { createSpecJsonWriter } from "../services/writes/spec-json-writer.js";
import type { ApiError } from "../types/api.js";
import type { EventBus } from "../watcher/event-bus.js";
import { createEventsRoute } from "./events.js";
import { createResourcesRoutes } from "./resources.js";
import { createSpecsRoutes } from "./specs.js";
import { createWritesRoutes } from "./writes.js";

/** 許可オリジン（1.5）: `http://localhost[:port]` / `http://127.0.0.1[:port]` のみ */
export const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export interface AppDeps {
  readonly context: RepoContext;
  /** SSE 配信元。watcher → bus の publish 配線はエントリ層（index.ts）が行う */
  readonly bus: EventBus;
  /** SSE keepalive 間隔（テスト注入用。省略時は events.ts のデフォルト 15 秒） */
  readonly keepaliveIntervalMs?: number;
  /** 書込監査ログの出力先（テスト注入用。省略時は stderr） */
  readonly auditSink?: AuditSink;
  /** 未知例外のログ出力（テスト注入用。省略時は console.error） */
  readonly logError?: (error: unknown) => void;
}

/**
 * 全サービス・全ルートを組み立てた Hono アプリを生成する。
 * Postcondition: ハンドラ内のあらゆる throw は ApiError JSON 応答に変換され、
 * プロセスを終了させない（13.4）。
 */
export function createApp(deps: AppDeps): Hono {
  const { context, bus } = deps;
  const logError =
    deps.logError ?? ((error: unknown) => console.error("[sdd-core-server] unhandled error:", error));

  // サービス層の組み立て（readValidations seam の本配線を含む）
  const scanner = createKiroScanner(context);
  const validationService = createValidationService(scanner);
  const specService = createSpecService({
    scanner,
    readValidations: (feature) => validationService.listForSpec(feature),
  });
  const steeringService = createSteeringService(context);
  const skillService = createSkillService(context);
  const adrService = createAdrService(context);

  // 書込層の組み立て（全書込は SafePathGuard 経由 + 監査ログ）
  const guard = createSafePathGuard(context);
  const audit = createAuditLog(deps.auditSink === undefined ? {} : { sink: deps.auditSink });
  const specJsonWriter = createSpecJsonWriter({ scanner, guard });

  const app = new Hono();

  // CORS: localhost オリジン限定（1.5）。許可外は CORS ヘッダーなし（= ブラウザが拒否）
  app.use(
    "*",
    cors({ origin: (origin) => (LOCALHOST_ORIGIN_PATTERN.test(origin) ? origin : "") }),
  );

  // エラーミドルウェア（13.1, 13.4, 11.4）
  app.onError((error, c) => {
    if (error instanceof AppError && error.code !== ErrorCode.REPO_INVALID) {
      const details = error.details as { fieldErrors?: Record<string, string[]> } | undefined;
      const body: ApiError = {
        error: {
          code: error.code,
          message: error.message,
          ...(details?.fieldErrors !== undefined ? { fieldErrors: details.fieldErrors } : {}),
        },
      };
      return c.json(body, ERROR_HTTP_STATUS[error.code]);
    }
    // 未知例外（REPO_INVALID 含む想定外の throw）: ログして 500。プロセスは継続する（13.4）
    logError(error);
    const body: ApiError = {
      error: { code: ErrorCode.INTERNAL_ERROR, message: String(error) },
    };
    return c.json(body, 500);
  });

  // ルートのマウント（design.md API Contract のエンドポイント一覧と 1:1）
  app.route("/api/specs", createSpecsRoutes({ specService, scanner }));
  app.route("/api", createResourcesRoutes({ context, steeringService, skillService, adrService }));
  app.route(
    "/api",
    createWritesRoutes({
      approvalWriter: createApprovalWriter({ specJsonWriter, audit }),
      rollbackWriter: createRollbackWriter({ specJsonWriter, audit }),
      adrWriter: createAdrWriter({ context, guard, audit }),
    }),
  );
  app.route(
    "/api/events",
    createEventsRoute(
      bus,
      deps.keepaliveIntervalMs === undefined ? {} : { keepaliveIntervalMs: deps.keepaliveIntervalMs },
    ),
  );

  return app;
}
