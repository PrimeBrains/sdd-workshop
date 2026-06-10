/**
 * 書込ルート — PUT /api/specs/:feature/approvals, POST /api/specs/:feature/rollback,
 * POST /api/adr（design.md API Contract WRITE 行。Requirements 9.1, 10.3, 11.4, 12.1）。
 *
 * 制約:
 * - ルートは zod 入力検証 + writer 委譲のみでロジックを持たない（design.md HonoApp + Routes）。
 *   失敗は AppError を throw し、HTTP 変換は app レベルのエラーミドルウェア（task 8.3）が担う
 * - zod 検証失敗は AppError(VALIDATION_FAILED, details.fieldErrors) → 422 + フィールド単位
 *   fieldErrors（11.4。ApiError.error.fieldErrors: Record<string, string[]>）
 * - CreateAdrInput.requirements の各参照は RefListParser で検証し、単一の要件 ID または
 *   クロス spec 形式 "<feature>/<id>" 以外を fieldErrors.requirements で拒否する（11.4）
 * - `:feature` パラメータは英数字 + `-` `_` のみ許可（design.md Security Considerations）。
 *   違反は不在 spec と同じ 404 SPEC_NOT_FOUND として扱う
 * - すべての書込は writer 群が SafePathGuard 経由で行う（12.1 — 本ルートは FS に触れない）
 * - アプリ全体へのマウント（`app.route("/api", ...)`）は api/app.ts（task 8.3）の責務
 */
import { Hono } from "hono";
import { z } from "zod";
import { AppError, ErrorCode } from "../errors/codes.js";
import { parseRefList } from "../parsers/ref-list.js";
import type { AdrWriter } from "../services/writes/adr-writer.js";
import type { ApprovalWriter } from "../services/writes/approval-writer.js";
import type { RollbackWriter } from "../services/writes/rollback-writer.js";
import { PATH_PARAM_PATTERN } from "./specs.js";

export interface WritesRoutesDeps {
  approvalWriter: ApprovalWriter;
  rollbackWriter: RollbackWriter;
  adrWriter: AdrWriter;
}

// ---------------------------------------------------------------------------
// zod スキーマ（エンドポイントごと。design.md API Contract の Request 列と 1:1）
// ---------------------------------------------------------------------------

/** PhaseName（types/spec.ts）と同語彙。不明フェーズはここで 422 になる（10.3 の多層防御の外側） */
const PHASE_NAME_SCHEMA = z.enum(["requirements", "design", "tasks"]);

/** PUT /api/specs/:feature/approvals のボディ（UpdateApprovalRequest） */
const APPROVAL_BODY_SCHEMA = z.object({
  phase: PHASE_NAME_SCHEMA,
  approved: z.boolean(),
});

/** POST /api/specs/:feature/rollback のボディ（RollbackRequest） */
const ROLLBACK_BODY_SCHEMA = z.object({
  targetPhase: PHASE_NAME_SCHEMA,
});

/**
 * requirements 参照 1 件の検証（11.4）: RefListParser（trace-notation.md 文法の唯一の実装）で
 * 単一トークンの要件 ID（`1.2`）またはクロス spec 形式（`<feature>/<id>`）のみ受理する。
 * 範囲表記・複数トークン・unparsable は拒否。
 */
function isRequirementRef(value: string): boolean {
  const tokens = parseRefList(value);
  const token = tokens[0];
  return tokens.length === 1 && token !== undefined &&
    (token.kind === "id" || token.kind === "cross-spec");
}

/** POST /api/adr のボディ（CreateAdrInput — design.md AdrWriter 契約と 1:1） */
const ADR_BODY_SCHEMA = z.object({
  title: z.string().min(1),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.string().min(1),
  alternatives: z.string().optional(),
  status: z.enum(["proposed", "accepted"]).optional(),
  app: z.string().optional(),
  specs: z.array(z.string()).optional(),
  requirements: z
    .array(
      z.string().refine(isRequirementRef, {
        message: '要件 ID（例 "1.2"）またはクロス spec 形式（例 "sdd-core/1.2"）で指定してください',
      }),
    )
    .optional(),
  slug: z.string().optional(),
});

/**
 * 書込ルートを持つ Hono サブアプリを生成する。
 * 呼び出し側が `/api` にマウントする（読取 GET と HTTP メソッドが異なるため衝突しない）。
 */
export function createWritesRoutes(deps: WritesRoutesDeps): Hono {
  const app = new Hono();

  app.put("/specs/:feature/approvals", async (c) => {
    const feature = validatedFeature(c.req.param("feature"));
    const body = parseBody(APPROVAL_BODY_SCHEMA, await readJsonBody(c.req.raw));
    return c.json(await deps.approvalWriter.updateApproval(feature, body.phase, body.approved));
  });

  app.post("/specs/:feature/rollback", async (c) => {
    const feature = validatedFeature(c.req.param("feature"));
    const body = parseBody(ROLLBACK_BODY_SCHEMA, await readJsonBody(c.req.raw));
    return c.json(await deps.rollbackWriter.rollback(feature, body.targetPhase));
  });

  app.post("/adr", async (c) => {
    const input = parseBody(ADR_BODY_SCHEMA, await readJsonBody(c.req.raw));
    return c.json(await deps.adrWriter.create(input), 201);
  });

  return app;
}

// ---------------------------------------------------------------------------
// 内部ヘルパー（検証のみ。ビジネスロジックは writer 側にある）
// ---------------------------------------------------------------------------

/** `:feature` の許可文字検証（読取ルートと同じ規則）。違反は不在 spec と同じ 404 */
function validatedFeature(feature: string): string {
  if (!PATH_PARAM_PATTERN.test(feature)) {
    throw new AppError(
      ErrorCode.SPEC_NOT_FOUND,
      `spec が存在しません（feature パラメータは英数字と - _ のみ許可）: ${feature}`,
    );
  }
  return feature;
}

/** ボディを JSON として読む。解釈不能は 422（fieldErrors なしの VALIDATION_FAILED） */
async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(
      ErrorCode.VALIDATION_FAILED,
      "リクエストボディを JSON として解釈できません",
    );
  }
}

/**
 * zod スキーマでボディを検証する。失敗は flatten のフィールド単位エラーを
 * details.fieldErrors に載せた AppError(VALIDATION_FAILED) → 422（11.4。
 * エラーミドルウェアが ApiError.error.fieldErrors へ写す）。
 */
function parseBody<Schema extends z.ZodType>(schema: Schema, body: unknown): z.output<Schema> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    const summary = formErrors.length > 0 ? formErrors.join("; ") : "fieldErrors を参照してください";
    throw new AppError(ErrorCode.VALIDATION_FAILED, `入力検証に失敗しました: ${summary}`, {
      fieldErrors: fieldErrors as Record<string, string[]>,
    });
  }
  return result.data;
}
