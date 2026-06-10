import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Position } from "../types/document.js";
import type { RequirementsDoc } from "../types/spec.js";
import { parseRequirements } from "./requirements.js";

type RequirementBlock = RequirementsDoc["requirements"][number];
type StructuredRequirement = Extract<RequirementBlock, { kind: "structured" }>;
type CriterionBlock = StructuredRequirement["criteria"][number];
type StructuredCriterion = Extract<CriterionBlock, { kind: "structured" }>;

/**
 * fixture: 本スペック自身の requirements.md（要件 13・AC 65・全 AC 和訳付き）。
 * テスト実行 cwd は sdd-dashboard/server のため import.meta.url 起点でリポジトリルートへ解決する。
 */
const fixturePath = fileURLToPath(
  new URL("../../../../.kiro/specs/sdd-core/requirements.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

function structuredRequirements(doc: RequirementsDoc): StructuredRequirement[] {
  return doc.requirements.filter(
    (block): block is StructuredRequirement => block.kind === "structured",
  );
}

function structuredCriteria(requirement: StructuredRequirement): StructuredCriterion[] {
  return requirement.criteria.filter(
    (block): block is StructuredCriterion => block.kind === "structured",
  );
}

function findCriterion(doc: RequirementsDoc, id: string): StructuredCriterion {
  for (const requirement of structuredRequirements(doc)) {
    const found = structuredCriteria(requirement).find((criterion) => criterion.id === id);
    if (found !== undefined) {
      return found;
    }
  }
  throw new Error(`criterion not found: ${id}`);
}

/**
 * 情報無欠落不変則（13.3）: requirements + otherBlocks の position を連結すると
 * 元文書全体 [0, source.length) を隙間なくカバーする。
 */
function assertNoInformationLoss(source: string, doc: RequirementsDoc): void {
  const positions: Position[] = [
    ...doc.requirements.map((block) => block.position),
    ...doc.otherBlocks.map((block) => block.position),
  ].sort((a, b) => a.startOffset - b.startOffset);

  let cursor = 0;
  for (const position of positions) {
    expect(position.startOffset).toBe(cursor);
    expect(position.endOffset).toBeGreaterThanOrEqual(position.startOffset);
    cursor = position.endOffset;
  }
  expect(cursor).toBe(source.length);
}

describe("parseRequirements（fixture: sdd-core requirements.md）", () => {
  const doc = parseRequirements(fixture);
  const reqs = structuredRequirements(doc);

  it("13 要件をすべて構造化エントリとして抽出する（3.1）", () => {
    expect(doc.requirements.length).toBe(13);
    expect(reqs.length).toBe(13);
    expect(reqs.map((requirement) => requirement.id)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
    ]);
  });

  it("要件ごとの AC 数が厳密値と一致し合計 65 になる（3.2）", () => {
    const acCounts = reqs.map((requirement) => structuredCriteria(requirement).length);
    expect(acCounts).toEqual([5, 5, 4, 4, 4, 7, 7, 6, 5, 4, 6, 4, 4]);
    expect(acCounts.reduce((sum, count) => sum + count, 0)).toBe(65);
    // criteria 配列に raw フォールバックは 1 件も無い（全 AC が構造化される）
    const totalBlocks = reqs.reduce((sum, requirement) => sum + requirement.criteria.length, 0);
    expect(totalBlocks).toBe(65);
  });

  it("Requirement 1 の ID・タイトル・Objective を抽出する（3.1）", () => {
    const req1 = reqs[0]!;
    expect(req1.id).toBe("1");
    expect(req1.title).toBe("サーバー起動と対象リポジトリ指定");
    expect(req1.objective).toBe(
      "開発者として、起動引数で任意リポジトリを指定して sdd-core サーバーを立ち上げたい。SDD Dashboard をどのリポジトリにも使える汎用ツールにするため。",
    );
  });

  it("AC は <要件番号>.<AC番号> 形式の ID を持つ（3.2）", () => {
    const req3 = reqs[2]!;
    expect(structuredCriteria(req3).map((criterion) => criterion.id)).toEqual([
      "3.1", "3.2", "3.3", "3.4",
    ]);
    const req6 = reqs[5]!;
    expect(structuredCriteria(req6).map((criterion) => criterion.id)).toEqual([
      "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7",
    ]);
  });

  it("AC 本文をインラインコード込みの原文どおり抽出する（3.2）", () => {
    const criterion = findCriterion(doc, "3.3");
    expect(criterion.text).toBe(
      "Where an acceptance criterion is followed by an indented `- 和訳:` bullet, the sdd-core server shall attach the bullet text to that criterion as its Japanese translation.",
    );
  });

  it("直後のインデント `- 和訳:` 箇条書きを当該 AC の和訳として関連付ける（3.3）", () => {
    expect(findCriterion(doc, "3.3").translationJa).toBe(
      "受入基準の直後にインデント付き `- 和訳:` 箇条書きが続く場合、sdd-core サーバーはその箇条書きテキストを当該基準の和訳として関連付ける。",
    );
    expect(findCriterion(doc, "1.2").translationJa).toBe(
      "指定されたリポジトリパスが存在しないか `.kiro/` ディレクトリを含まない場合、sdd-core サーバーは非ゼロの終了コードと、不正なパスを特定できるエラーメッセージとともに終了する。",
    );
    expect(findCriterion(doc, "13.4").translationJa).toBe(
      "リクエスト処理中に予期しない例外が発生した場合、sdd-core サーバーはサーバープロセスを終了させることなく、構造化されたサーバーエラーレスポンスを返す。",
    );
  });

  it("65 AC すべてに和訳が付与される（3.3）", () => {
    for (const requirement of reqs) {
      for (const criterion of structuredCriteria(requirement)) {
        expect(criterion.translationJa, `criterion ${criterion.id}`).not.toBeNull();
        expect(criterion.translationJa).toMatch(/。$/u);
      }
    }
  });

  it("要件と AC にソース位置情報を含める（3.1, 3.2）", () => {
    const req1 = reqs[0]!;
    expect(req1.position.startLine).toBe(20); // 「### Requirement 1: ...」の行
    expect(fixture.slice(req1.position.startOffset, req1.position.endOffset)).toMatch(
      /^### Requirement 1: サーバー起動と対象リポジトリ指定/u,
    );

    const ac11 = structuredCriteria(req1)[0]!;
    expect(ac11.id).toBe("1.1");
    expect(ac11.position.startLine).toBe(26); // 「1. When the sdd-core server is started ...」の行
    expect(ac11.position.endLine).toBe(27); // 和訳 bullet までを含む
    expect(fixture.slice(ac11.position.startOffset, ac11.position.endOffset)).toMatch(
      /^1\. When the sdd-core server is started/u,
    );

    for (const requirement of reqs) {
      expect(requirement.position.endOffset).toBeGreaterThan(requirement.position.startOffset);
      for (const criterion of structuredCriteria(requirement)) {
        expect(criterion.position.startOffset).toBeGreaterThanOrEqual(
          requirement.position.startOffset,
        );
        expect(criterion.position.endOffset).toBeLessThanOrEqual(requirement.position.endOffset);
      }
    }
  });

  it("Introduction / Boundary Context をセクションとして otherBlocks に保持する", () => {
    const sectionTitles = doc.otherBlocks
      .filter((block) => block.kind === "structured")
      .map((block) => block.section.title);
    expect(sectionTitles).toContain("Introduction");
    expect(sectionTitles).toContain("Boundary Context");
  });

  it("requirements + otherBlocks の和が文書全体を欠落なくカバーする（13.3）", () => {
    assertNoInformationLoss(fixture, doc);
  });
});

describe("parseRequirements（合成入力）", () => {
  it("和訳 bullet が無い AC は translationJa が null になる（3.3）", () => {
    const source = [
      "### Requirement 1: テスト",
      "",
      "**Objective:** 目的文。",
      "",
      "#### Acceptance Criteria",
      "",
      "1. The system shall do A.",
      "   - 和訳: システムは A をする。",
      "2. The system shall do B.",
      "",
    ].join("\n");
    const doc = parseRequirements(source);
    const req = structuredRequirements(doc)[0]!;
    expect(req.objective).toBe("目的文。");
    const criteria = structuredCriteria(req);
    expect(criteria.map((criterion) => criterion.id)).toEqual(["1.1", "1.2"]);
    expect(criteria[0]!.translationJa).toBe("システムは A をする。");
    expect(criteria[1]!.translationJa).toBeNull();
    assertNoInformationLoss(source, doc);
  });

  it("和訳以外のネスト bullet は和訳として扱わない（3.3）", () => {
    const source = [
      "### Requirement 2: ネスト",
      "",
      "1. The system shall do C.",
      "   - note: これは和訳ではない。",
      "",
    ].join("\n");
    const doc = parseRequirements(source);
    const req = structuredRequirements(doc)[0]!;
    expect(req.objective).toBeNull();
    expect(structuredCriteria(req)[0]!.translationJa).toBeNull();
  });

  it("要件見出しが無い文書は全体が otherBlocks に入る（13.2）", () => {
    const source = "# Doc\n\n## Notes\n\n本文。\n";
    const doc = parseRequirements(source);
    expect(doc.requirements).toEqual([]);
    expect(doc.otherBlocks.length).toBeGreaterThan(0);
    assertNoInformationLoss(source, doc);
  });

  it("空文書は空の RequirementsDoc を返す", () => {
    const doc = parseRequirements("");
    expect(doc.requirements).toEqual([]);
    expect(doc.otherBlocks).toEqual([]);
  });
});
