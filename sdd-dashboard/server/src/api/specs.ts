/**
 * 読取ルート（specs）— GET /api/specs, /api/specs/:feature, /api/specs/:feature/trace
 * （design.md API Contract。Requirements 2.1, 2.2, 6.1）。
 *
 * 制約:
 * - ルートはサービス委譲のみでロジックを持たない（design.md HonoApp + Routes）。
 *   失敗は AppError を throw し、HTTP 変換は app レベルのエラーミドルウェア（task 8.3）が担う
 * - `:feature` パラメータは英数字 + `-` `_` のみ許可（design.md Security Considerations）。
 *   違反は不在 spec と同じ 404 SPEC_NOT_FOUND として扱う
 * - trace のクロス spec 参照（6.6）は、detail に現れる参照先 feature の requirements.md を
 *   scanner 経由で事前ロードし、buildTraceGraph の同期リゾルバへ渡して解決する
 * - アプリ全体へのマウント（`app.route("/api/specs", ...)`）と
 *   ValidationService → SpecService.readValidations の配線は api/app.ts（task 8.3）の責務
 */
import { Hono } from "hono";
import { AppError, ErrorCode } from "../errors/codes.js";
import { parseRequirements } from "../parsers/requirements.js";
import { ARTIFACT_FILES, type KiroScanner } from "../services/kiro-scanner.js";
import type { SpecService } from "../services/spec-service.js";
import { buildTraceGraph } from "../services/trace-graph.js";
import type { RequirementsDoc, SpecDetail, TaskEntry } from "../types/spec.js";
import type { RefToken, TraceGraph } from "../types/trace.js";

/**
 * パスパラメータ（`:feature` / `:name` / `:id`）の許可文字。
 * design.md Security Considerations: 英数字 + `-` `_` のみ許可し、
 * リポジトリルート外へ解決され得る入力を経路の入口で拒否する。
 */
export const PATH_PARAM_PATTERN = /^[A-Za-z0-9_-]+$/;

export interface SpecsRoutesDeps {
  specService: SpecService;
  /** trace のクロス spec 参照解決（6.6）が参照先 requirements.md を読むための走査器 */
  scanner: KiroScanner;
}

/**
 * specs 読取ルートを持つ Hono サブアプリを生成する。
 * 呼び出し側が `/api/specs` にマウントする。
 */
export function createSpecsRoutes(deps: SpecsRoutesDeps): Hono {
  const app = new Hono();
  app.get("/", async (c) => c.json(await deps.specService.list()));
  app.get("/:feature/trace", async (c) => c.json(await loadTrace(deps, c.req.param("feature"))));
  app.get("/:feature", async (c) => c.json(await loadDetail(deps, c.req.param("feature"))));
  return app;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー（ルートが委譲する読取合成。ロジックはサービス側にある）
// ---------------------------------------------------------------------------

/** `:feature` 検証 + SpecService.get 委譲（2.2）。違反・不在は 404 SPEC_NOT_FOUND */
async function loadDetail(deps: SpecsRoutesDeps, feature: string): Promise<SpecDetail> {
  if (!PATH_PARAM_PATTERN.test(feature)) {
    throw new AppError(
      ErrorCode.SPEC_NOT_FOUND,
      `spec が存在しません（feature パラメータは英数字と - _ のみ許可）: ${feature}`,
    );
  }
  return deps.specService.get(feature);
}

/** SpecService.get + buildTraceGraph の合成（6.1）。クロス spec は事前ロードで解決（6.6） */
async function loadTrace(deps: SpecsRoutesDeps, feature: string): Promise<TraceGraph> {
  const detail = await loadDetail(deps, feature);
  const resolved = await preloadCrossSpecRequirements(deps.scanner, detail);
  return buildTraceGraph(
    {
      feature: detail.summary.feature,
      requirements: detail.requirements,
      design: detail.design,
      tasks: detail.tasks,
    },
    { resolveRequirements: (name) => resolved.get(name) ?? null },
  );
}

/**
 * detail に現れるクロス spec 参照（6.6）の参照先 requirements.md を事前ロードする。
 * 参照先 spec / requirements.md 不在は null = リゾルバが「不在 spec」として扱い
 * broken-link 診断になる（6.4）。
 */
async function preloadCrossSpecRequirements(
  scanner: KiroScanner,
  detail: SpecDetail,
): Promise<Map<string, RequirementsDoc | null>> {
  const resolved = new Map<string, RequirementsDoc | null>();
  await Promise.all(
    [...collectCrossSpecFeatures(detail)].map(async (feature) => {
      const source = await scanner.readSpecFile(feature, ARTIFACT_FILES.requirements);
      resolved.set(feature, source === null ? null : parseRequirements(source));
    }),
  );
  return resolved;
}

/** 3 つのエッジ源泉（design 表 / コンポーネント Requirements / タスク注記）から参照先 feature を集める */
function collectCrossSpecFeatures(detail: SpecDetail): Set<string> {
  const features = new Set<string>();
  const note = (tokens: RefToken[]): void => {
    for (const token of tokens) {
      if (token.kind === "cross-spec") {
        features.add(token.feature);
      }
    }
  };
  for (const row of detail.design?.traceability ?? []) {
    if (row.kind === "structured") {
      note(row.refs);
    }
  }
  for (const entry of detail.design?.componentRequirements ?? []) {
    note(entry.refs);
  }
  const visit = (tasks: TaskEntry[]): void => {
    for (const task of tasks) {
      note(task.requirements);
      visit(task.subtasks);
    }
  };
  visit(detail.tasks?.tasks ?? []);
  return features;
}
