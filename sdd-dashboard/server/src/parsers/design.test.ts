import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SectionNode } from "../types/document.js";
import type { DesignDoc, TraceabilityRow } from "../types/spec.js";
import { parseDesign } from "./design.js";

type TraceabilityBlock = DesignDoc["traceability"][number];
type StructuredRow = Extract<TraceabilityBlock, { kind: "structured" }>;

/**
 * fixture: 旧 spec `dashboard` の実 design.md（範囲表記入り Traceability 表 +
 * コンポーネント詳細 `| Requirements |` フィールド表 + サマリー表 `Req Coverage` 列 +
 * 括弧付き注記行 `8.2（...）` を含む）。
 * テスト実行 cwd は sdd-dashboard/server のため import.meta.url 起点でリポジトリルートへ解決する。
 */
const fixturePath = fileURLToPath(
  new URL("../../../../.kiro/specs/dashboard/design.md", import.meta.url),
);
const fixture = readFileSync(fixturePath, "utf8");

function structuredRows(doc: DesignDoc): StructuredRow[] {
  return doc.traceability.filter((block): block is StructuredRow => block.kind === "structured");
}

function flattenSections(sections: SectionNode[]): SectionNode[] {
  return sections.flatMap((section) => [section, ...flattenSections(section.children)]);
}

describe("parseDesign（fixture: dashboard design.md）", () => {
  const doc = parseDesign(fixture);

  it("見出し階層をタイトル・深さ・position 付きセクションツリーとして返す（4.1）", () => {
    expect(doc.sections.length).toBe(1);
    const root = doc.sections[0]!;
    expect(root.title).toBe("設計書: dashboard");
    expect(root.depth).toBe(1);
    expect(root.position.startLine).toBe(1);
    expect(root.position.startOffset).toBe(0);
    expect(root.position.endOffset).toBe(fixture.length);

    expect(root.children.map((section) => section.title)).toEqual([
      "Overview",
      "Boundary Commitments",
      "Architecture",
      "File Structure Plan",
      "System Flows",
      "Requirements Traceability",
      "Components and Interfaces",
      "Data Models",
      "Error Handling",
      "Testing Strategy",
      "Security Considerations",
      "Performance & Scalability",
      "Migration Strategy",
      "Supporting References",
    ]);
    expect(root.children.every((section) => section.depth === 2)).toBe(true);

    const traceabilitySection = root.children[5]!;
    expect(traceabilitySection.title).toBe("Requirements Traceability");
    expect(traceabilitySection.position.startLine).toBe(369);

    // ネスト spot check: Components and Interfaces > Utility Layer > `lib/task-tree.ts`
    const utility = root.children[6]!.children.find((section) => section.title === "Utility Layer");
    expect(utility).toBeDefined();
    expect(utility!.depth).toBe(3);
    const taskTree = utility!.children.find((section) => section.title === "lib/task-tree.ts");
    expect(taskTree).toBeDefined();
    expect(taskTree!.depth).toBe(4);
    expect(taskTree!.position.startLine).toBe(828);
  });

  it("Traceability 表の 20 行をすべて構造化エントリとして抽出する（4.2）", () => {
    expect(doc.traceability.length).toBe(20);
    expect(structuredRows(doc).length).toBe(20);
  });

  it("行を refs・summary・components・interfaces・flows に構造化する（4.2）", () => {
    const row0 = structuredRows(doc)[0]!;
    expect(row0.position.startLine).toBe(373);
    expect(row0.summary).toBe("WorkbenchPage 単一ページ構成");
    expect(row0.components).toBe("`pages/WorkbenchPage.tsx`, `App.tsx`");
    expect(row0.interfaces).toBe("React Router");
    expect(row0.flows).toBe("初期マウント");
  });

  it("旧範囲表記 `1.1-1.6` を legacy フラグ付きで 6 個の ID に展開する（4.2 / RefListParser 6.3）", () => {
    const row0 = structuredRows(doc)[0]!;
    expect(row0.refs).toEqual([
      {
        kind: "range",
        from: "1.1",
        to: "1.6",
        expanded: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"],
        legacy: true,
        raw: "1.1-1.6",
      },
    ]);
  });

  it("複数トークンの refs セル `7.1-7.11, 8.1-8.7` を 2 個の range トークンへ分解する（4.2）", () => {
    const row6 = structuredRows(doc)[6]!;
    expect(row6.summary).toBe("GanttFullscreen + ProgressInputPanel ホスト");
    expect(row6.refs.length).toBe(2);
    const [first, second] = row6.refs;
    expect(first).toMatchObject({ kind: "range", from: "7.1", to: "7.11", legacy: true });
    expect(second).toMatchObject({ kind: "range", from: "8.1", to: "8.7", legacy: true });
    expect(first?.kind === "range" ? first.expanded.length : null).toBe(11);
    expect(second?.kind === "range" ? second.expanded.length : null).toBe(7);
  });

  it("fixture の全 Traceability 行で refs が空でなく unparsable を含まない", () => {
    for (const row of structuredRows(doc)) {
      expect(row.refs.length, `row at line ${row.position.startLine}`).toBeGreaterThan(0);
      for (const token of row.refs) {
        expect(token.kind, `token ${token.raw}`).not.toBe("unparsable");
      }
    }
  });

  it("サマリー表 Req Coverage 列（23 行）+ コンポーネント詳細 Requirements 行（15 行）= 38 エントリを抽出する（4.3）", () => {
    expect(doc.componentRequirements.length).toBe(38);
    // 文書順: 先頭はサマリー表の最初の行（line 400）
    const first = doc.componentRequirements[0]!;
    expect(first.component).toBe("pages/WorkbenchPage.tsx");
    expect(first.position.startLine).toBe(400);
    expect(first.refs.map((token) => token.raw)).toEqual([
      "1.1-1.6",
      "12.1-12.5",
      "13.3",
      "18.1-18.5",
      "19.1-19.2",
    ]);
  });

  it("コンポーネント詳細の `| Requirements |` フィールド行から参照を抽出する（4.3）", () => {
    const useEvm = doc.componentRequirements.filter(
      (entry) => entry.component === "hooks/useEvm.ts",
    );
    // サマリー表行 + 詳細フィールド行の 2 源泉
    expect(useEvm.length).toBe(2);
    for (const entry of useEvm) {
      expect(entry.refs).toEqual([
        {
          kind: "range",
          from: "13.1",
          to: "13.7",
          expanded: ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7"],
          legacy: true,
          raw: "13.1-13.7",
        },
      ]);
    }
  });

  it("Req Coverage 列のワイルドカード `15.*` は unparsable トークンとして raw を保持する（4.3, 4.4）", () => {
    const tokens = doc.componentRequirements.find(
      (entry) => entry.component === "tokens/evm-tokens.ts",
    );
    expect(tokens).toBeDefined();
    expect(tokens!.refs).toEqual([
      { kind: "id", id: "14.1", raw: "14.1" },
      { kind: "unparsable", raw: "15.*" },
    ]);
  });

  it("括弧付き注記行 `8.2（...）` は unparsable トークンとして原文 raw を保持しつつ抽出を継続する（4.4）", () => {
    const taskTree = doc.componentRequirements.filter(
      (entry) => entry.component === "lib/task-tree.ts",
    );
    expect(taskTree.length).toBe(2);
    // サマリー表行（line 421）: `8.2` は素直にパースされる
    const summaryEntry = taskTree.find((entry) => entry.position.startLine === 421);
    expect(summaryEntry).toBeDefined();
    expect(summaryEntry!.refs).toEqual([{ kind: "id", id: "8.2", raw: "8.2" }]);
    // 詳細フィールド行（line 833）: 括弧付き注記は unparsable + 原文 raw（バッククォート込み）
    const fieldEntry = taskTree.find((entry) => entry.position.startLine === 833);
    expect(fieldEntry).toBeDefined();
    expect(fieldEntry!.refs).toEqual([
      { kind: "unparsable", raw: "8.2（`ProgressInputTask.ancestors` の生成元）" },
    ]);
  });

  it("componentRequirements は文書順（position 昇順）で返る", () => {
    const lines = doc.componentRequirements.map((entry) => entry.position.startLine);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });

  it("セクションツリーの全ノードが position を持ち depth 1-6 に収まる（4.1）", () => {
    const all = flattenSections(doc.sections);
    expect(all.length).toBeGreaterThanOrEqual(60); // fixture には 60 以上の見出しがある
    for (const section of all) {
      expect(section.depth).toBeGreaterThanOrEqual(1);
      expect(section.depth).toBeLessThanOrEqual(6);
      expect(section.position.endOffset).toBeGreaterThan(section.position.startOffset);
    }
  });
});

describe("parseDesign（合成入力）", () => {
  it("セル数が合わない Traceability 行は raw + 診断で返し残りの行の抽出を継続する（4.4）", () => {
    const source = [
      "## Requirements Traceability",
      "",
      "| Requirement | Summary | Components | Interfaces | Flows |",
      "|---|---|---|---|---|",
      "| 1.1 | A | c1 | i1 | f1 |",
      "| broken row without enough cells |",
      "| 2.1, 2.2 | B | c2 | i2 | f2 |",
      "",
    ].join("\n");
    const doc = parseDesign(source);

    expect(doc.traceability.length).toBe(3);
    const [first, second, third] = doc.traceability;

    expect(first!.kind).toBe("structured");
    const firstRow = first as StructuredRow;
    expect(firstRow.refs).toEqual([{ kind: "id", id: "1.1", raw: "1.1" }]);
    expect(firstRow.summary).toBe("A");
    expect(firstRow.components).toBe("c1");
    expect(firstRow.interfaces).toBe("i1");
    expect(firstRow.flows).toBe("f1");

    expect(second!.kind).toBe("raw");
    const rawRow = second as Extract<TraceabilityBlock, { kind: "raw" }>;
    expect(rawRow.markdown).toBe("| broken row without enough cells |");
    expect(rawRow.reason).toContain("5");
    expect(rawRow.position.startLine).toBe(6);

    // 4.4: 失敗行の後続行も抽出を継続する
    expect(third!.kind).toBe("structured");
    const thirdRow = third as StructuredRow;
    expect(thirdRow.refs).toEqual([
      { kind: "id", id: "2.1", raw: "2.1" },
      { kind: "id", id: "2.2", raw: "2.2" },
    ]);
    expect(thirdRow.summary).toBe("B");
  });

  it("Requirements Traceability セクションが無い文書は traceability が空になる", () => {
    const source = "# 設計書\n\n## Overview\n\n本文。\n";
    const doc = parseDesign(source);
    expect(doc.traceability).toEqual([]);
    expect(doc.componentRequirements).toEqual([]);
    expect(doc.sections.length).toBe(1);
  });

  it("空文書は空の DesignDoc を返す（例外を投げない）", () => {
    const doc = parseDesign("");
    expect(doc).toEqual({ sections: [], traceability: [], componentRequirements: [] });
  });

  it("traceability 行の構造化結果に TraceabilityRow の全フィールドが揃う（型整合）", () => {
    const source = [
      "## Requirements Traceability",
      "",
      "| Requirement | Summary | Components | Interfaces | Flows |",
      "|---|---|---|---|---|",
      "| 3.1 | S | C | I | — |",
      "",
    ].join("\n");
    const doc = parseDesign(source);
    const row = doc.traceability[0] as StructuredRow;
    const expected: TraceabilityRow = {
      refs: [{ kind: "id", id: "3.1", raw: "3.1" }],
      summary: "S",
      components: "C",
      interfaces: "I",
      flows: "—",
    };
    expect({
      refs: row.refs,
      summary: row.summary,
      components: row.components,
      interfaces: row.interfaces,
      flows: row.flows,
    }).toEqual(expected);
  });
});
