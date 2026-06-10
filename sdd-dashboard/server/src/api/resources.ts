/**
 * 読取ルート（resources）— GET /api/repo, /api/steering(:name), /api/skills(:name),
 * /api/adr(:id)（design.md API Contract。Requirements 7.1, 7.2, 7.3）。
 *
 * 制約:
 * - ルートはサービス委譲のみでロジックを持たない（design.md HonoApp + Routes）。
 *   失敗は AppError を throw し、HTTP 変換は app レベルのエラーミドルウェア（task 8.3）が担う
 * - `:name` / `:id` パラメータは英数字 + `-` `_` のみ許可（design.md Security
 *   Considerations）。違反は不在リソースと同じ 404 RESOURCE_NOT_FOUND として扱う
 *   （ADR の `:id` は拡張子なしファイル名。例: `0001-sdd-dashboard-local-web-app`）
 * - アプリ全体へのマウント（`app.route("/api", ...)`）は api/app.ts（task 8.3）の責務
 */
import { Hono } from "hono";
import { basename } from "node:path";
import type { RepoContext } from "../config.js";
import { AppError, ErrorCode } from "../errors/codes.js";
import type { AdrService } from "../services/adr-service.js";
import type { SkillService } from "../services/skill-service.js";
import type { SteeringService } from "../services/steering-service.js";
import type { RepoInfo } from "../types/api.js";
import { PATH_PARAM_PATTERN } from "./specs.js";

export interface ResourcesRoutesDeps {
  /** GET /api/repo の RepoInfo 導出元（パス定義は RepoContext に集約、steering SSoT） */
  context: RepoContext;
  steeringService: SteeringService;
  skillService: SkillService;
  adrService: AdrService;
}

/**
 * repo / steering / skills / adr 読取ルートを持つ Hono サブアプリを生成する。
 * 呼び出し側が `/api` にマウントする。
 */
export function createResourcesRoutes(deps: ResourcesRoutesDeps): Hono {
  const repoInfo: RepoInfo = {
    repoRoot: deps.context.repoRoot,
    name: basename(deps.context.repoRoot),
  };

  const app = new Hono();
  app.get("/repo", (c) => c.json(repoInfo));
  app.get("/steering", async (c) => c.json(await deps.steeringService.list()));
  app.get("/steering/:name", async (c) =>
    c.json(await deps.steeringService.get(validatedParam(c.req.param("name")))),
  );
  app.get("/skills", async (c) => c.json(await deps.skillService.list()));
  app.get("/skills/:name", async (c) =>
    c.json(await deps.skillService.get(validatedParam(c.req.param("name")))),
  );
  app.get("/adr", async (c) => c.json(await deps.adrService.list()));
  app.get("/adr/:id", async (c) =>
    c.json(await deps.adrService.get(validatedParam(c.req.param("id")))),
  );
  return app;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/** `:name` / `:id` の許可文字検証。違反は不在リソースと同じ 404 RESOURCE_NOT_FOUND */
function validatedParam(value: string): string {
  if (!PATH_PARAM_PATTERN.test(value)) {
    throw new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `リソースが存在しません（パスパラメータは英数字と - _ のみ許可）: ${value}`,
    );
  }
  return value;
}
