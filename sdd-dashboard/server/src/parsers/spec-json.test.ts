import { describe, expect, it } from "vitest";
import { parseSpecJson } from "./spec-json.js";

// ---------------------------------------------------------------------------
// フィクスチャ（.kiro/specs/*/spec.json の実フォーマットに準拠）
// ---------------------------------------------------------------------------

/** app フィールドあり・全キー揃いの正常 spec.json */
const VALID_WITH_APP = JSON.stringify({
  feature_name: "sdd-core",
  app: "sdd-dashboard",
  created_at: "2026-06-10T06:03:44.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  language: "ja",
  phase: "tasks-approved",
  approvals: {
    requirements: { generated: true, approved: true },
    design: { generated: true, approved: true },
    tasks: { generated: true, approved: false },
  },
  ready_for_implementation: false,
});

/** app フィールド欠落（未分類）の正常 spec.json */
const VALID_WITHOUT_APP = JSON.stringify({
  feature_name: "legacy-feature",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  language: "en",
  phase: "requirements-generated",
  approvals: {
    requirements: { generated: true, approved: false },
    design: { generated: false, approved: false },
    tasks: { generated: false, approved: false },
  },
  ready_for_implementation: false,
});

/** JSON 構文として不正な内容 */
const BROKEN_JSON = '{ "feature_name": "broken", "phase": ';

/** 全フィールド null のメタデータ（パース失敗時の期待形） */
const ALL_NULL_META = {
  app: null,
  phase: null,
  language: null,
  approvals: null,
  readyForImplementation: null,
  createdAt: null,
  updatedAt: null,
};

// ---------------------------------------------------------------------------
// 系統 1: 正常入力（厳密値での取得、2.1 のメタデータ列挙 + 2.5 の app）
// ---------------------------------------------------------------------------

describe("parseSpecJson — 正常系", () => {
  it("app ありの正常入力からフェーズ・承認フラグ・言語・タイムスタンプ・app を厳密値で返す", () => {
    expect(parseSpecJson(VALID_WITH_APP)).toEqual({
      meta: {
        app: "sdd-dashboard",
        phase: "tasks-approved",
        language: "ja",
        approvals: {
          requirements: { generated: true, approved: true },
          design: { generated: true, approved: true },
          tasks: { generated: true, approved: false },
        },
        readyForImplementation: false,
        createdAt: "2026-06-10T06:03:44.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      raw: null,
      diagnostics: [],
    });
  });

  it("app 欠落時は app: null（未分類）を返し、診断は出さない（2.5）", () => {
    const result = parseSpecJson(VALID_WITHOUT_APP);
    expect(result.meta.app).toBeNull();
    expect(result.diagnostics).toEqual([]);
    expect(result.meta.phase).toBe("requirements-generated");
    expect(result.meta.language).toBe("en");
  });

  it("app: null の明示指定も欠落と同様 null を返し、診断は出さない（2.5）", () => {
    const source = JSON.stringify({ ...JSON.parse(VALID_WITHOUT_APP), app: null });
    const result = parseSpecJson(source);
    expect(result.meta.app).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 系統 2: 欠落・不正 JSON（エントリを落とさず parse-failure 診断、2.3）
// ---------------------------------------------------------------------------

describe("parseSpecJson — 欠落・不正 JSON（2.3）", () => {
  it("不正 JSON では全 null メタ + raw 保持 + parse-failure 診断を返す（throw しない）", () => {
    const result = parseSpecJson(BROKEN_JSON);
    expect(result.meta).toEqual(ALL_NULL_META);
    expect(result.raw).toBe(BROKEN_JSON);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ kind: "parse-failure", position: null });
  });

  it("spec.json 欠落（source: null）では全 null メタ + parse-failure 診断を返す", () => {
    const result = parseSpecJson(null);
    expect(result.meta).toEqual(ALL_NULL_META);
    expect(result.raw).toBeNull();
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ kind: "parse-failure", position: null });
  });

  it("JSON として valid でもオブジェクトでない入力（配列・スカラー）は parse-failure とする", () => {
    for (const source of ["[1, 2]", "42", '"text"', "null"]) {
      const result = parseSpecJson(source);
      expect(result.meta).toEqual(ALL_NULL_META);
      expect(result.raw).toBe(source);
      expect(result.diagnostics[0]).toMatchObject({ kind: "parse-failure" });
    }
  });
});

// ---------------------------------------------------------------------------
// 系統 3: フィールド単位の欠落・型不正（フィールドは null、他フィールドは生かす）
// ---------------------------------------------------------------------------

describe("parseSpecJson — フィールド単位の欠落・型不正", () => {
  it("必須キー欠落はそのフィールドのみ null + missing-key 診断とし、他フィールドは取得する", () => {
    const data = JSON.parse(VALID_WITH_APP) as Record<string, unknown>;
    delete data["phase"];
    const result = parseSpecJson(JSON.stringify(data));
    expect(result.meta.phase).toBeNull();
    expect(result.meta.language).toBe("ja");
    expect(result.meta.app).toBe("sdd-dashboard");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ kind: "missing-key" });
    expect(result.diagnostics[0]?.message).toContain("phase");
  });

  it("型不正のフィールドは null + invalid-key 診断とする（app 非 string を含む）", () => {
    const data = JSON.parse(VALID_WITH_APP) as Record<string, unknown>;
    data["app"] = 123;
    data["ready_for_implementation"] = "yes";
    const result = parseSpecJson(JSON.stringify(data));
    expect(result.meta.app).toBeNull();
    expect(result.meta.readyForImplementation).toBeNull();
    expect(result.meta.phase).toBe("tasks-approved");
    expect(result.diagnostics).toHaveLength(2);
    for (const diagnostic of result.diagnostics) {
      expect(diagnostic.kind).toBe("invalid-key");
    }
  });

  it("approvals が 3 フェーズ × {generated, approved} boolean の形でなければ null + 診断とする", () => {
    const data = JSON.parse(VALID_WITH_APP) as Record<string, unknown>;
    data["approvals"] = {
      requirements: { generated: true, approved: "yes" },
      design: { generated: true, approved: true },
      tasks: { generated: true, approved: true },
    };
    const result = parseSpecJson(JSON.stringify(data));
    expect(result.meta.approvals).toBeNull();
    expect(result.meta.phase).toBe("tasks-approved");
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({ kind: "invalid-key" });
    expect(result.diagnostics[0]?.message).toContain("approvals");
  });
});
