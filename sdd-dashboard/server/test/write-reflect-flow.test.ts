/**
 * 書込 → 反映データフロー結合テスト — tasks.md 9.3。
 * （design.md Testing Strategy「Integration Tests 2・3」。
 *   Requirements 2.4, 9.1, 9.5, 11.1, 11.5, 12.4）
 *
 * 本番アプリ全体（createApp — 全 writer / SafePathGuard / scanner の本配線）を
 * mkdtemp の一時リポジトリへマウントし、HTTP 経由の書込がディスクを正しく変え、
 * その結果が読取 API へ再起動なしで反映されるフロー全体を担保する。
 *
 * ## 期待値の導出（RED: 実行前にソース仕様から手計算で確定）
 *
 * シナリオ 1（承認フロー）: 初期状態 requirements-approved / design-generated。
 * PUT {phase:"design", approved:true} 後の導出値（spec-json-writer.ts）:
 * - derivePhase: tasks.approved=false, tasks.generated=false, design.generated=true
 *   → "design-generated"（語彙に design-approved は存在しない）
 * - deriveReady: tasks.approved=false → false
 * - 未知フィールド（トップレベル feature_name / future_field、approvals 内 note）は
 *   逐語保持、created_at 不変、updated_at のみ更新（9.5）
 *
 * シナリオ 2（ADR フロー）: 空リポジトリ → 初回 POST は id=1、
 * タイトル "Adopt Flow Testing" → kebab-case スラッグ "adopt-flow-testing"
 * → ファイル名 "0001-adopt-flow-testing.md"（adr-writer.ts deriveSlug / padNumber）。
 *
 * 同番号競合（11.5）の決定的再現: 「次番号のファイルを事前作成する」方式は
 * scanMaxNumber がその番号を走査で拾い次番号へ進むため、構造的に EEXIST に
 * 到達できない。競合は採番走査（readdir）の後・書込（link）の前に同名が書かれる
 * TOCTOU であり、同一 slug・異なる本文の 2 並行 POST で決定的に再現する:
 * 両ハンドラはボディ JSON 解釈（マイクロタスク）→ readdir（libuv マクロタスク）の順で
 * 進むため、どちらの書込よりも先に両方の走査が完了し、両者が同じ番号 0002 を算出する。
 * link(2) の原子性により正確に一方だけが成功し、他方は EEXIST → 409。
 * 本文を変えてあるため「既存ファイルがバイト単位で無傷」が実質的な検証になる。
 *
 * シナリオ 3（書込中断、12.4）: spec ディレクトリを chmod 0o555 にして
 * writeFileAtomic の temp ファイル作成を EACCES で失敗させる
 * （task 7.1 safe-path.test.ts と同じ最も本番忠実な障害注入を HTTP 層越しに行う）。
 * EACCES は AppError ではないためエラーミドルウェアで 500 INTERNAL_ERROR になり、
 * 対象 spec.json は旧内容のままバイト一致で残る（temp 残骸もない）。
 * 偽 pass 防止: 権限復旧後に同一リクエストが成功することで、失敗が注入欠陥のみに
 * 起因していたことを証明する。権限は afterEach でも必ず復旧する。
 */
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/api/app.js";
import { createRepoContext, type RepoContext } from "../src/config.js";
import { ErrorCode } from "../src/errors/codes.js";
import { extractFrontmatter, validateAdrFrontmatter } from "../src/parsers/frontmatter.js";
import type { ApiError } from "../src/types/api.js";
import type { AdrDoc, AdrSummary } from "../src/types/resources.js";
import type { SpecSummary } from "../src/types/spec.js";
import { createEventBus } from "../src/watcher/event-bus.js";

const FEATURE = "flow-spec";
const INITIAL_UPDATED_AT = "2026-06-01T00:00:00Z";

/**
 * 初期 spec.json（requirements-approved / design-generated）。
 * 未知フィールドをトップレベル（feature_name / future_field）と
 * approvals 内（requirements.note）の両レベルに仕込む（9.5 の保持検証用）。
 * バイト一致比較（12.4）の基準にもなるため固定文字列として保持する。
 */
const INITIAL_SPEC_JSON = `${JSON.stringify(
  {
    feature_name: FEATURE,
    app: "demo-app",
    phase: "design-generated",
    language: "japanese",
    approvals: {
      requirements: { generated: true, approved: true, note: "レビュー済み" },
      design: { generated: true, approved: false },
      tasks: { generated: false, approved: false },
    },
    ready_for_implementation: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: INITIAL_UPDATED_AT,
    future_field: { nested: ["keep", 1, true] },
  },
  null,
  2,
)}\n`;

// ---------------------------------------------------------------------------
// テストリソース管理（権限復旧 → 一時ディレクトリ削除の順で必ず解放する）
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
const restoreFns: Array<() => void> = [];

afterEach(() => {
  while (restoreFns.length > 0) {
    restoreFns.pop()?.();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** 一時リポジトリ（.kiro/specs 付き）に本番組み立て（createApp）をマウントする */
function makeApp(): { context: RepoContext; app: Hono } {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-write-flow-"));
  tempDirs.push(repoRoot);
  mkdirSync(join(repoRoot, ".kiro", "specs"), { recursive: true });
  const result = createRepoContext(repoRoot, 0);
  if (!result.ok) {
    throw new Error(`一時リポジトリが不正です: ${result.message}`);
  }
  const app = createApp({
    context: result.context,
    bus: createEventBus(),
    auditSink: () => undefined,
    logError: () => undefined,
  });
  return { context: result.context, app };
}

/** 初期 spec.json を持つ spec ディレクトリを作り、そのパスを返す */
function seedSpec(context: RepoContext): { specDir: string; specPath: string } {
  const specDir = join(context.kiroDir, "specs", FEATURE);
  mkdirSync(specDir, { recursive: true });
  const specPath = join(specDir, "spec.json");
  writeFileSync(specPath, INITIAL_SPEC_JSON);
  return { specDir, specPath };
}

/** GET して 200 を確認し JSON を返す */
async function getJson<T>(app: Hono, path: string): Promise<T> {
  const res = await app.request(path);
  expect(res.status).toBe(200);
  return (await res.json()) as T;
}

/** JSON ボディ付きリクエストの RequestInit */
function jsonBody(method: "PUT" | "POST", body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** design フェーズ承認の PUT（シナリオ 1・3 で同一リクエストを共有） */
async function putDesignApproval(app: Hono): Promise<Response> {
  return await app.request(
    `/api/specs/${FEATURE}/approvals`,
    jsonBody("PUT", { phase: "design", approved: true }),
  );
}

/** adr-writer の formatLocalDate と同じローカル日付（クロック注入なしの date 期待値） */
function localToday(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// シナリオ 1: 承認 API → ディスク上の spec.json → 一覧 API への反映
// ---------------------------------------------------------------------------

describe("承認フロー: PUT approvals → ディスク → GET /api/specs（2.4, 9.1, 9.5）", () => {
  it("承認がディスクへ有効 JSON・未知フィールド逐語保持で書かれ、再起動なしで一覧へ反映される", async () => {
    const { context, app } = makeApp();
    const { specPath } = seedSpec(context);

    // 事前状態の固定（偽 pass 防止: 後段の「反映」が実際の変化であることを保証する）
    const before = await getJson<SpecSummary[]>(app, "/api/specs");
    const beforeEntry = before.find((s) => s.feature === FEATURE);
    expect(beforeEntry?.approvals?.design.approved).toBe(false);
    expect(beforeEntry?.updatedAt).toBe(INITIAL_UPDATED_AT);

    // --- 承認 API 呼び出し（9.1: 更新後メタデータが返る） ---
    const res = await putDesignApproval(app);
    expect(res.status).toBe(200);
    const summary = (await res.json()) as SpecSummary;
    expect(summary.feature).toBe(FEATURE);
    expect(summary.approvals).toEqual({
      requirements: { generated: true, approved: true },
      design: { generated: true, approved: true },
      tasks: { generated: false, approved: false },
    });
    // 導出フェーズ（derivePhase: tasks 未生成のため design-generated のまま）と ready 再計算
    expect(summary.phase).toBe("design-generated");
    expect(summary.readyForImplementation).toBe(false);

    // --- ディスク上の spec.json: 有効 JSON であること（12.4 の正常側） ---
    const onDisk = readFileSync(specPath, "utf-8");
    const parsed = JSON.parse(onDisk) as Record<string, unknown>; // 不正 JSON なら throw で fail
    const approvals = parsed["approvals"] as Record<string, unknown>;

    // 9.5: 変更対象外フィールドの逐語保持（トップレベル + approvals 内の両レベル）
    expect(parsed["feature_name"]).toBe(FEATURE);
    expect(parsed["app"]).toBe("demo-app");
    expect(parsed["language"]).toBe("japanese");
    expect(parsed["created_at"]).toBe("2026-06-01T00:00:00Z");
    expect(parsed["future_field"]).toEqual({ nested: ["keep", 1, true] });
    expect(approvals["requirements"]).toEqual({ generated: true, approved: true, note: "レビュー済み" });

    // 更新対象: design.approved / phase / ready_for_implementation / updated_at のみ
    expect(approvals["design"]).toEqual({ generated: true, approved: true });
    expect(approvals["tasks"]).toEqual({ generated: false, approved: false });
    expect(parsed["phase"]).toBe("design-generated");
    expect(parsed["ready_for_implementation"]).toBe(false);
    expect(parsed["updated_at"]).not.toBe(INITIAL_UPDATED_AT); // 9.5: updated_at は更新される
    expect(Number.isNaN(Date.parse(parsed["updated_at"] as string))).toBe(false);

    // --- 2.4: 一覧 API へ再起動なしで反映（キャッシュではなくディスク読み直し） ---
    const after = await getJson<SpecSummary[]>(app, "/api/specs");
    const afterEntry = after.find((s) => s.feature === FEATURE);
    expect(afterEntry?.approvals?.design.approved).toBe(true);
    expect(afterEntry?.phase).toBe("design-generated");
    expect(afterEntry?.updatedAt).toBe(parsed["updated_at"]);
    expect(afterEntry?.diagnostics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// シナリオ 2: ADR 作成 API → 規約準拠ファイル → 一覧反映 → 同番号競合 409
// ---------------------------------------------------------------------------

describe("ADR フロー: POST /api/adr → 規約準拠ファイル → 一覧 → 同番号競合 409（11.1, 11.5）", () => {
  it("作成 → frontmatter 規約準拠 → 一覧反映 → 同番号競合は 409 で既存ファイル無傷", async () => {
    const { context, app } = makeApp();
    const adrDir = join(context.kiroDir, "adr");

    // --- 作成（11.1: adr/ 未作成のリポジトリで 0001 + kebab-case スラッグ） ---
    const todayBefore = localToday();
    const res = await app.request(
      "/api/adr",
      jsonBody("POST", {
        title: "Adopt Flow Testing",
        context: "書込フローの結合テスト方針を決める必要がある。",
        decision: "書込 → 反映のフロー全体を 1 テストで担保する。",
        consequences: "回帰がデータフロー単位で検知される。",
        specs: ["flow-spec"],
        requirements: ["flow-spec/1.1"],
      }),
    );
    const todayAfter = localToday();
    expect(res.status).toBe(201);
    const doc = (await res.json()) as AdrDoc;
    expect(doc.name).toBe("0001-adopt-flow-testing");

    // --- ディスク: 規約準拠ファイル生成（本プロジェクト自身の frontmatter パーサーで検証） ---
    const filePath = join(adrDir, "0001-adopt-flow-testing.md");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe(doc.content); // 応答が運ぶ全文 = ディスクの実体
    const extraction = extractFrontmatter(content);
    expect(extraction.kind).toBe("frontmatter");
    if (extraction.kind === "frontmatter") {
      const { frontmatter, diagnostics } = validateAdrFrontmatter(extraction.data, extraction.position);
      expect(diagnostics).toEqual([]); // 規約 9 キーすべて型準拠
      expect(frontmatter).not.toBeNull();
      const { date, ...rest } = frontmatter ?? {};
      expect([todayBefore, todayAfter]).toContain(date); // 当日（深夜跨ぎ許容）
      expect(rest).toEqual({
        id: 1,
        title: "Adopt Flow Testing",
        status: "proposed", // 省略時デフォルト
        app: null, // 省略時 null
        specs: ["flow-spec"],
        requirements: ["flow-spec/1.1"],
        supersedes: null,
        superseded_by: null,
      });
    }
    // 必須本文セクション（11.2 の規約構造）
    expect(content).toContain("# ADR-0001: Adopt Flow Testing");
    expect(content).toContain("## Context");
    expect(content).toContain("## Decision");
    expect(content).toContain("## Consequences");

    // --- ADR 一覧 API へ反映 ---
    const list = await getJson<AdrSummary[]>(app, "/api/adr");
    expect(list.map((e) => e.name)).toEqual(["0001-adopt-flow-testing"]);
    expect(list[0]?.frontmatter?.id).toBe(1);
    expect(list[0]?.diagnostics).toEqual([]);

    // --- 同番号競合（11.5）: 同一 slug・異なる本文の 2 並行 POST で TOCTOU を決定的に再現 ---
    // （ヘッダーコメント参照: 両走査は両書込より先に完了するため、両者が番号 0002 を算出する）
    const conflictInput = (label: string): unknown => ({
      title: `Conflict Candidate ${label}`,
      slug: "conflicting-decision", // slug 上書きで同一ファイル名 0002-conflicting-decision.md を強制
      context: `${label} 側の文脈。`,
      decision: `${label} 側の決定。`,
      consequences: `${label} 側の帰結。`,
    });
    const [resA, resB] = await Promise.all([
      app.request("/api/adr", jsonBody("POST", conflictInput("A"))),
      app.request("/api/adr", jsonBody("POST", conflictInput("B"))),
    ]);
    // 正確に一方が 201、他方が 409（両方成功＝競合が再現していない偽 pass を排除）
    expect([resA.status, resB.status].sort()).toEqual([201, 409]);
    const winnerRes = resA.status === 201 ? resA : resB;
    const loserRes = resA.status === 409 ? resA : resB;
    const winnerDoc = (await winnerRes.json()) as AdrDoc;
    expect(winnerDoc.name).toBe("0002-conflicting-decision");
    const loserBody = (await loserRes.json()) as ApiError;
    expect(loserBody.error.code).toBe(ErrorCode.ADR_NUMBER_CONFLICT);

    // 既存（勝者）ファイルは敗者の試行で上書きされない — 本文が異なるためバイト一致が実質検証
    const conflictedContent = readFileSync(join(adrDir, "0002-conflicting-decision.md"), "utf-8");
    expect(conflictedContent).toBe(winnerDoc.content);
    // 部分書込の temp 残骸が残らず、ディレクトリは 2 ファイルのみ
    expect(readdirSync(adrDir).sort()).toEqual([
      "0001-adopt-flow-testing.md",
      "0002-conflicting-decision.md",
    ]);

    // 一覧 API も成功した 2 件のみを反映する
    const finalList = await getJson<AdrSummary[]>(app, "/api/adr");
    expect(finalList.map((e) => e.name)).toEqual([
      "0001-adopt-flow-testing",
      "0002-conflicting-decision",
    ]);
  });
});

// ---------------------------------------------------------------------------
// シナリオ 3: 書込中断シミュレーション — 対象ファイルは旧内容のまま破損しない（12.4）
// ---------------------------------------------------------------------------

describe("書込中断シミュレーション（12.4）", () => {
  it("書込が途中で失敗しても spec.json は旧内容のままバイト一致で残り、復旧後は同一リクエストが成功する", async () => {
    const { context, app } = makeApp();
    const { specDir, specPath } = seedSpec(context);

    // 障害注入: temp ファイル作成（writeFileAtomic の最初の書込ステップ）を EACCES で中断させる
    chmodSync(specDir, 0o555);
    restoreFns.push(() => chmodSync(specDir, 0o755)); // 失敗時も afterEach で必ず復旧する

    const res = await putDesignApproval(app);
    expect(res.status).toBe(500); // 生 EACCES は AppError ではない → INTERNAL_ERROR（プロセス継続）
    const body = (await res.json()) as ApiError;
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);

    // 12.4: 対象ファイルは「旧内容」のままバイト一致（部分書込・破損がない）
    const onDisk = readFileSync(specPath, "utf-8");
    expect(onDisk).toBe(INITIAL_SPEC_JSON);
    expect(() => JSON.parse(onDisk)).not.toThrow(); // 有効 JSON のまま
    expect(readdirSync(specDir)).toEqual(["spec.json"]); // .tmp- 残骸なし

    // 読取 API も旧状態のまま（中断した書込が反映済みに見えない）
    const list = await getJson<SpecSummary[]>(app, "/api/specs");
    const entry = list.find((s) => s.feature === FEATURE);
    expect(entry?.approvals?.design.approved).toBe(false);
    expect(entry?.updatedAt).toBe(INITIAL_UPDATED_AT);
    expect(entry?.diagnostics).toEqual([]);

    // 偽 pass 防止: 権限を復旧すると同一リクエストが成功する
    // （直前の 500 が注入した障害のみに起因し、対象ファイルが使用可能なまま残った証明）
    chmodSync(specDir, 0o755);
    const retry = await putDesignApproval(app);
    expect(retry.status).toBe(200);
    const recovered = JSON.parse(readFileSync(specPath, "utf-8")) as Record<string, unknown>;
    const approvals = recovered["approvals"] as Record<string, unknown>;
    expect(approvals["design"]).toEqual({ generated: true, approved: true }); // 「完全な新内容」側
    expect(recovered["future_field"]).toEqual({ nested: ["keep", 1, true] }); // 復旧後も未知フィールド保持
  });
});
