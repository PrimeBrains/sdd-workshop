import { describe, expect, it } from "vitest";
import YAML from "yaml";
import type { Position } from "../types/document.js";
import {
  extractFrontmatter,
  validateAdrFrontmatter,
  validateValidationFrontmatter,
} from "./frontmatter.js";

// ---------------------------------------------------------------------------
// フィクスチャ
// ---------------------------------------------------------------------------

/** adr.md 規約 9 キー + 未知キー 1 個の正常 frontmatter ブロック（行 1〜14） */
const ADR_BLOCK = [
  "---",
  "id: 1",
  "title: ローカル Web アプリ",
  "status: accepted",
  "date: 2026-06-10",
  "app: sdd-dashboard",
  "specs:",
  "  - sdd-core",
  "requirements:",
  "  - sdd-core/7.5",
  "supersedes: null",
  "superseded_by: null",
  "custom_note: keep me",
  "---",
].join("\n");

const ADR_BODY = "\n\n# ADR-0001: ローカル Web アプリ\n\n## Context\n\n背景。\n";
const ADR_SOURCE = ADR_BLOCK + ADR_BODY;

/** ADR_BLOCK の期待 YAML マップ（未知キー custom_note を含む厳密値） */
const ADR_DATA = {
  id: 1,
  title: "ローカル Web アプリ",
  status: "accepted",
  date: "2026-06-10",
  app: "sdd-dashboard",
  specs: ["sdd-core"],
  requirements: ["sdd-core/7.5"],
  supersedes: null,
  superseded_by: null,
  custom_note: "keep me",
};

/** 診断 position 引き回しの検証に使う任意の Position */
const SOME_POSITION: Position = { startLine: 1, endLine: 5, startOffset: 0, endOffset: 42 };

// ---------------------------------------------------------------------------
// 系統 1: 正常 frontmatter（全キー厳密値 + 未知キー保持）
// ---------------------------------------------------------------------------

describe("extractFrontmatter — 正常系", () => {
  it("先頭 --- ブロックを YAML マップとして抽出し、position と本文を厳密に返す", () => {
    const result = extractFrontmatter(ADR_SOURCE);
    expect(result).toEqual({
      kind: "frontmatter",
      data: ADR_DATA,
      position: {
        startLine: 1,
        endLine: 14,
        startOffset: 0,
        endOffset: ADR_BLOCK.length,
      },
      body: ADR_BODY,
    });
  });

  it("frontmatter position と body の連結が元文書全体をカバーする（情報無欠落）", () => {
    const result = extractFrontmatter(ADR_SOURCE);
    if (result.kind !== "frontmatter") {
      expect.unreachable("正常 frontmatter が raw フォールバックになった");
    }
    expect(ADR_SOURCE.slice(result.position.startOffset, result.position.endOffset) + result.body).toBe(
      ADR_SOURCE,
    );
  });

  it("本文なし（frontmatter のみ）の文書では body が空文字列になる", () => {
    const result = extractFrontmatter(ADR_BLOCK);
    if (result.kind !== "frontmatter") {
      expect.unreachable("正常 frontmatter が raw フォールバックになった");
    }
    expect(result.data).toEqual(ADR_DATA);
    expect(result.body).toBe("");
  });
});

describe("validateAdrFrontmatter — 正常系", () => {
  it("規約 9 キーを厳密値で検証し、未知キーをそのまま保持する", () => {
    const result = validateAdrFrontmatter(ADR_DATA);
    expect(result).toEqual({
      frontmatter: {
        id: 1,
        title: "ローカル Web アプリ",
        status: "accepted",
        date: "2026-06-10",
        app: "sdd-dashboard",
        specs: ["sdd-core"],
        requirements: ["sdd-core/7.5"],
        supersedes: null,
        superseded_by: null,
        custom_note: "keep me",
      },
      diagnostics: [],
    });
  });
});

describe("validateValidationFrontmatter — 正常系", () => {
  it("既知 4 キーを厳密値で検証し、未知キーをそのまま保持する", () => {
    const result = validateValidationFrontmatter({
      type: "design",
      feature: "sdd-core",
      date: "2026-06-09",
      decision: "GO",
      reviewer: "claude",
    });
    expect(result).toEqual({
      frontmatter: {
        type: "design",
        feature: "sdd-core",
        date: "2026-06-09",
        decision: "GO",
        reviewer: "claude",
      },
      diagnostics: [],
    });
  });
});

// ---------------------------------------------------------------------------
// 系統 2: キー欠落（nullable キーは null、必須キーは診断 + frontmatter null）
// ---------------------------------------------------------------------------

describe("validateAdrFrontmatter — キー欠落", () => {
  it("nullable キー（app / supersedes / superseded_by）の欠落は診断なしで null になる（7.6）", () => {
    const result = validateAdrFrontmatter({
      id: 2,
      title: "横断決定",
      status: "proposed",
      date: "2026-06-10",
      specs: [],
      requirements: [],
    });
    expect(result).toEqual({
      frontmatter: {
        id: 2,
        title: "横断決定",
        status: "proposed",
        date: "2026-06-10",
        app: null,
        specs: [],
        requirements: [],
        supersedes: null,
        superseded_by: null,
      },
      diagnostics: [],
    });
  });

  it("必須キーの欠落は欠落キーごとの診断を返し frontmatter は null になる", () => {
    const result = validateAdrFrontmatter(
      { id: 3, status: "accepted", date: "2026-06-10", requirements: [] },
      SOME_POSITION,
    );
    expect(result).toEqual({
      frontmatter: null,
      diagnostics: [
        {
          kind: "missing-key",
          message: 'frontmatter の必須キー "title" が欠落しています',
          position: SOME_POSITION,
        },
        {
          kind: "missing-key",
          message: 'frontmatter の必須キー "specs" が欠落しています',
          position: SOME_POSITION,
        },
      ],
    });
  });

  it("既知キーの型不正は invalid-key 診断を返し frontmatter は null になる", () => {
    const result = validateAdrFrontmatter({
      id: "one",
      title: "型不正",
      status: "accepted",
      date: "2026-06-10",
      specs: ["sdd-core"],
      requirements: [],
      app: 42,
    });
    expect(result).toEqual({
      frontmatter: null,
      diagnostics: [
        {
          kind: "invalid-key",
          message: 'frontmatter キー "id" の型が不正です（期待: number）',
          position: null,
        },
        {
          kind: "invalid-key",
          message: 'frontmatter キー "app" の型が不正です（期待: string | null）',
          position: null,
        },
      ],
    });
  });
});

describe("validateValidationFrontmatter — キー欠落", () => {
  it("decision / date の欠落は診断なしで null になる（gap レポートは decision を持たない）", () => {
    const result = validateValidationFrontmatter({ type: "gap", feature: "sdd-core" });
    expect(result).toEqual({
      frontmatter: { type: "gap", feature: "sdd-core", date: null, decision: null },
      diagnostics: [],
    });
  });

  it("必須キー（type / feature）の欠落は診断を返し frontmatter は null になる", () => {
    const result = validateValidationFrontmatter({ date: "2026-06-09" }, SOME_POSITION);
    expect(result).toEqual({
      frontmatter: null,
      diagnostics: [
        {
          kind: "missing-key",
          message: 'frontmatter の必須キー "type" が欠落しています',
          position: SOME_POSITION,
        },
        {
          kind: "missing-key",
          message: 'frontmatter の必須キー "feature" が欠落しています',
          position: SOME_POSITION,
        },
      ],
    });
  });

  it("type が gap | design | impl 以外なら invalid-key 診断を返し frontmatter は null になる", () => {
    const result = validateValidationFrontmatter({ type: "bogus", feature: "sdd-core" });
    expect(result).toEqual({
      frontmatter: null,
      diagnostics: [
        {
          kind: "invalid-key",
          message: 'frontmatter キー "type" の型が不正です（期待: "gap" | "design" | "impl"）',
          position: null,
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// 系統 3: frontmatter 欠落・YAML 構文エラー → 本文全体を raw + 診断（7.5）
// ---------------------------------------------------------------------------

describe("extractFrontmatter — 欠落・不正系（7.5）", () => {
  it("YAML 構文エラー時は文書全体を raw markdown + parse-failure 診断で返す", () => {
    const source = "---\ntitle: [unclosed\n---\n\n# Body\n";
    // 動的期待値: 実装と同じ入力を yaml に与えて得たエラーメッセージと突き合わせる
    let yamlErrorMessage = "";
    try {
      YAML.parse("title: [unclosed");
    } catch (error) {
      yamlErrorMessage = (error as Error).message;
    }
    expect(yamlErrorMessage).not.toBe("");

    const reason = `frontmatter の YAML 構文が不正です: ${yamlErrorMessage}`;
    expect(extractFrontmatter(source)).toEqual({
      kind: "raw",
      raw: {
        kind: "raw",
        position: { startLine: 1, endLine: 5, startOffset: 0, endOffset: source.length },
        markdown: source,
        reason,
      },
      diagnostics: [
        {
          kind: "parse-failure",
          message: reason,
          position: { startLine: 1, endLine: 3, startOffset: 0, endOffset: 24 },
        },
      ],
    });
  });

  it("frontmatter 欠落時（先頭 --- ブロックなし）は文書全体を raw + 診断で返す", () => {
    const source = "# No frontmatter\n\nbody\n";
    const reason = "frontmatter が欠落しています（先頭 --- ブロックなし）";
    expect(extractFrontmatter(source)).toEqual({
      kind: "raw",
      raw: {
        kind: "raw",
        position: { startLine: 1, endLine: 3, startOffset: 0, endOffset: source.length },
        markdown: source,
        reason,
      },
      diagnostics: [{ kind: "parse-failure", message: reason, position: null }],
    });
  });

  it("閉じ --- がない場合は frontmatter 欠落として文書全体を raw + 診断で返す", () => {
    const source = "---\ntitle: x\n";
    const reason = "frontmatter が欠落しています（先頭 --- ブロックなし）";
    expect(extractFrontmatter(source)).toEqual({
      kind: "raw",
      raw: {
        kind: "raw",
        position: { startLine: 1, endLine: 2, startOffset: 0, endOffset: source.length },
        markdown: source,
        reason,
      },
      diagnostics: [{ kind: "parse-failure", message: reason, position: null }],
    });
  });

  it("frontmatter が YAML マップでない場合（リスト等）は文書全体を raw + 診断で返す", () => {
    const source = "---\n- a\n---\nbody\n";
    const reason = "frontmatter が YAML マップではありません";
    expect(extractFrontmatter(source)).toEqual({
      kind: "raw",
      raw: {
        kind: "raw",
        position: { startLine: 1, endLine: 4, startOffset: 0, endOffset: source.length },
        markdown: source,
        reason,
      },
      diagnostics: [
        {
          kind: "parse-failure",
          message: reason,
          position: { startLine: 1, endLine: 3, startOffset: 0, endOffset: 11 },
        },
      ],
    });
  });

  it("空 frontmatter（--- 直後に ---）は YAML マップでないとして raw + 診断で返す", () => {
    const source = "---\n---\nbody\n";
    const reason = "frontmatter が YAML マップではありません";
    const result = extractFrontmatter(source);
    if (result.kind !== "raw") {
      expect.unreachable("空 frontmatter が raw フォールバックにならなかった");
    }
    expect(result.raw.markdown).toBe(source);
    expect(result.raw.position.startOffset).toBe(0);
    expect(result.raw.position.endOffset).toBe(source.length);
    expect(result.diagnostics).toEqual([
      {
        kind: "parse-failure",
        message: reason,
        position: { startLine: 1, endLine: 2, startOffset: 0, endOffset: 7 },
      },
    ]);
  });

  it("空文字列入力でも例外を投げず raw（空文書）+ 診断を返す", () => {
    const result = extractFrontmatter("");
    if (result.kind !== "raw") {
      expect.unreachable("空文書が raw フォールバックにならなかった");
    }
    expect(result.raw.markdown).toBe("");
    expect(result.raw.position).toEqual({ startLine: 1, endLine: 1, startOffset: 0, endOffset: 0 });
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0]?.kind).toBe("parse-failure");
  });
});
