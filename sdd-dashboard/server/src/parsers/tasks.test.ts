import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Position } from "../types/document.js";
import type { TaskEntry, TasksDoc } from "../types/spec.js";
import { parseTasks } from "./tasks.js";

/**
 * fixture A: 旧 spec dashboard の tasks.md（全タスク [x]・(P) 15 個・3 注記・
 * `4.2a` 形式 ID・`- [~]*` 非標準ステートを含む安定 fixture）。
 * fixture B: 本スペック自身の tasks.md（`3.4 (P)` の前置 (P) 形式を含む。
 * チェック状態は実装進行で変わるため構造的事実のみ検証する）。
 */
const dashboardFixturePath = fileURLToPath(
  new URL("../../../../.kiro/specs/dashboard/tasks.md", import.meta.url),
);
const dashboardFixture = readFileSync(dashboardFixturePath, "utf8");
const sddCoreFixturePath = fileURLToPath(
  new URL("../../../../.kiro/specs/sdd-core/tasks.md", import.meta.url),
);
const sddCoreFixture = readFileSync(sddCoreFixturePath, "utf8");

/** majors + subtasks を文書順でフラットに列挙する */
function flatten(tasks: TaskEntry[]): TaskEntry[] {
  return tasks.flatMap((task) => [task, ...flatten(task.subtasks)]);
}

function findTask(doc: TasksDoc, id: string): TaskEntry {
  const found = flatten(doc.tasks).find((task) => task.id === id);
  if (found === undefined) {
    throw new Error(`task not found: ${id}`);
  }
  return found;
}

/**
 * 情報無欠落不変則（13.3）: 全タスクエントリ + otherBlocks の position を
 * 連結すると元文書全体 [0, source.length) を隙間なくカバーする。
 */
function assertNoInformationLoss(source: string, doc: TasksDoc): void {
  const positions: Position[] = [
    ...flatten(doc.tasks).map((task) => task.position),
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

describe("parseTasks（fixture: dashboard tasks.md）", () => {
  const doc = parseTasks(dashboardFixture);

  it("9 個のメジャータスクを抽出し、サブタスクを親に関連付ける（5.1, 5.2）", () => {
    expect(doc.tasks.map((task) => task.id)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
    expect(doc.tasks.map((task) => task.subtasks.length)).toEqual([5, 8, 3, 6, 2, 1, 1, 1, 4]);
    expect(flatten(doc.tasks).length).toBe(40); // 9 majors + 31 subs
  });

  it("サブタスクの ID は親メジャー番号から導出される（5.2）", () => {
    const major4 = doc.tasks[3]!;
    expect(major4.id).toBe("4");
    expect(major4.subtasks.map((task) => task.id)).toEqual([
      "4.1", "4.2", "4.2a", "4.3", "4.4", "4.5",
    ]);
    for (const major of doc.tasks) {
      for (const sub of major.subtasks) {
        expect(sub.id.split(".")[0]).toBe(major.id);
      }
    }
  });

  it("完了状態 [x] をすべての構造化タスクで抽出する（5.1）", () => {
    for (const task of flatten(doc.tasks)) {
      expect(task.checked, `task ${task.id}`).toBe(true);
    }
  });

  it("(P) 並列マーカーを厳密に 15 個抽出する（5.1）", () => {
    const parallelIds = flatten(doc.tasks)
      .filter((task) => task.parallel)
      .map((task) => task.id);
    expect(parallelIds).toEqual([
      "1.1", "1.2", "1.3", "1.4", "1.5",
      "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7",
      "4.1", "4.2a", "6.1",
    ]);
    // 説明文に (P) マーカーは残らない
    for (const task of flatten(doc.tasks)) {
      expect(task.description).not.toMatch(/\(P\)/u);
    }
  });

  it("タスク 1.1 の説明・3 注記・詳細 bullet を厳密値で保持する（5.1, 5.3, 5.4）", () => {
    const task = findTask(doc, "1.1");
    expect(task.description).toBe("デザイントークン `tokens/evm-tokens.ts` を追加");
    expect(task.checked).toBe(true);
    expect(task.parallel).toBe(true);
    expect(task.optional).toBe(false);
    expect(task.details).toEqual([
      "`client/src/tokens/evm-tokens.ts` を新規作成",
      "モックアップ `mockup/shared.jsx` 行 24–50 の `EVM` 定数を完全移植",
      "`EvmToken` 型をエクスポート",
      "`import { EVM } from '@/tokens/evm-tokens'` で参照可能になる *(observable: TypeScript 型補完が効く)*",
    ]);
    expect(task.requirements).toEqual([{ kind: "id", id: "14.1", raw: "14.1" }]);
    expect(task.boundary).toBe("tokens/evm-tokens.ts");
    expect(task.depends).toEqual([]);
  });

  it("_Requirements:_ の旧範囲表記は RefListParser の文法どおり range トークンになる（5.3）", () => {
    const task = findTask(doc, "2.1"); // _Requirements: 2.1-2.8, 17.3_
    expect(task.requirements).toEqual([
      {
        kind: "range",
        from: "2.1",
        to: "2.8",
        expanded: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"],
        legacy: true,
        raw: "2.1-2.8",
      },
      { kind: "id", id: "17.3", raw: "17.3" },
    ]);
  });

  it("_Depends:_ は ID 列へ展開して保持する（範囲表記は連番展開）（5.3）", () => {
    expect(findTask(doc, "2.1").depends).toEqual(["1.1", "1.4", "1.5"]);
    // _Depends: 2.1-2.8, 3.1_
    expect(findTask(doc, "3.2").depends).toEqual([
      "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "3.1",
    ]);
    // 自由記述は raw のまま保持（情報無欠落）
    expect(findTask(doc, "4.2a").depends).toEqual(["なし（純関数）"]);
  });

  it("メジャータスクは注記・詳細を持たず説明のみ保持する（5.1, 5.2）", () => {
    const major1 = doc.tasks[0]!;
    expect(major1.description).toBe("基盤レイヤーを追加");
    expect(major1.details).toEqual([]);
    expect(major1.requirements).toEqual([]);
    expect(major1.depends).toEqual([]);
    expect(major1.boundary).toBeNull();
  });

  it("全サブタスクが _Boundary:_ を持つ（5.3）", () => {
    for (const major of doc.tasks) {
      for (const sub of major.subtasks) {
        expect(sub.boundary, `task ${sub.id}`).not.toBeNull();
      }
    }
    expect(findTask(doc, "9.2").boundary).toBe("lib/formatters.ts");
  });

  it("タスクエントリにソース位置情報を含める（3.4）", () => {
    const major1 = doc.tasks[0]!;
    expect(major1.position.startLine).toBe(9); // 「- [x] 1. 基盤レイヤーを追加」の行
    const task11 = findTask(doc, "1.1");
    expect(task11.position.startLine).toBe(10);
    expect(
      dashboardFixture.slice(task11.position.startOffset, task11.position.endOffset),
    ).toMatch(/^- \[x\] 1\.1 デザイントークン/u);
    expect(
      dashboardFixture.slice(task11.position.startOffset, task11.position.endOffset),
    ).toMatch(/_Boundary: tokens\/evm-tokens\.ts_$/u);
  });

  it("非標準チェック状態 [~] の行は raw フォールバックとして保持する（13.2）", () => {
    expect(flatten(doc.tasks).some((task) => task.id === "8.2")).toBe(false);
    const raw = doc.otherBlocks.find((block) => block.markdown.includes("[~]* 8.2"));
    expect(raw).toBeDefined();
    // 注記・詳細を含む項目全体が markdown として残る（情報無欠落）
    expect(raw!.markdown).toContain("_Requirements: 20.4_");
  });

  it("タスク + otherBlocks の和が文書全体を欠落なくカバーする（13.3）", () => {
    assertNoInformationLoss(dashboardFixture, doc);
  });
});

describe("parseTasks（fixture: sdd-core tasks.md）", () => {
  const doc = parseTasks(sddCoreFixture);

  it("メジャータスク 1-9 を抽出する（5.2）", () => {
    expect(doc.tasks.map((task) => task.id)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
  });

  it("ID 直後の前置 (P) マーカーを抽出し説明から除去する（5.1）", () => {
    const task = findTask(doc, "3.4");
    expect(task.parallel).toBe(true);
    expect(task.description).toBe("tasks パーサーを実装する");
    expect(task.boundary).toBe("TasksParser");
    expect(task.requirements).toEqual([
      { kind: "id", id: "5.1", raw: "5.1" },
      { kind: "id", id: "5.2", raw: "5.2" },
      { kind: "id", id: "5.3", raw: "5.3" },
      { kind: "id", id: "5.4", raw: "5.4" },
    ]);
  });

  it("_Depends:_ をタスク ID 列として抽出する（5.3）", () => {
    expect(findTask(doc, "5.1").depends).toEqual(["3.2", "3.3", "3.4", "4.1"]);
    expect(findTask(doc, "6.2").depends).toEqual(["6.1"]);
  });

  it("タスク + otherBlocks の和が文書全体を欠落なくカバーする（13.3）", () => {
    assertNoInformationLoss(sddCoreFixture, doc);
  });
});

describe("parseTasks（合成入力）", () => {
  it("後送りマーカー `*` を未完了・完了の両形式で抽出する（5.1）", () => {
    const source = [
      "- [ ] 1. 親タスク",
      "- [ ]* 1.1 任意のテストタスク",
      "- [x]* 1.2 完了済みの任意タスク (P)",
      "",
    ].join("\n");
    const doc = parseTasks(source);
    const sub1 = findTask(doc, "1.1");
    expect(sub1.optional).toBe(true);
    expect(sub1.checked).toBe(false);
    expect(sub1.parallel).toBe(false);
    expect(sub1.description).toBe("任意のテストタスク");
    const sub2 = findTask(doc, "1.2");
    expect(sub2.optional).toBe(true);
    expect(sub2.checked).toBe(true);
    expect(sub2.parallel).toBe(true);
    const major = findTask(doc, "1");
    expect(major.optional).toBe(false);
    expect(major.checked).toBe(false);
    expect(major.subtasks.map((task) => task.id)).toEqual(["1.1", "1.2"]);
    assertNoInformationLoss(source, doc);
  });

  it("未知の注記（_Blocked:_ 等）は詳細 bullet として保持する（5.4）", () => {
    const source = [
      "- [ ] 1. 親",
      "- [ ] 1.1 サブ",
      "  - 詳細 bullet",
      "  - _Blocked: 7.1 完了待ち_",
      "  - _Requirements: 1.1, 2.2_",
      "  - _Depends: 1.2_",
      "  - _Boundary: FooService_",
      "",
    ].join("\n");
    const doc = parseTasks(source);
    const task = findTask(doc, "1.1");
    expect(task.details).toEqual(["詳細 bullet", "_Blocked: 7.1 完了待ち_"]);
    expect(task.requirements.map((token) => token.kind === "id" ? token.id : token.raw)).toEqual([
      "1.1", "2.2",
    ]);
    expect(task.depends).toEqual(["1.2"]);
    expect(task.boundary).toBe("FooService");
    assertNoInformationLoss(source, doc);
  });

  it("親メジャーの無いサブタスクはトップレベルに保持する（5.2）", () => {
    const source = "- [ ] 2.1 親なしサブタスク\n";
    const doc = parseTasks(source);
    expect(doc.tasks.map((task) => task.id)).toEqual(["2.1"]);
    expect(doc.tasks[0]!.subtasks).toEqual([]);
    assertNoInformationLoss(source, doc);
  });

  it("折り返されたタスク行は 1 つの説明へ正規化される（5.1）", () => {
    const source = [
      "- [ ] 1.1 折り返しのある",
      "  説明文",
      "  - 詳細",
      "",
    ].join("\n");
    const doc = parseTasks(source);
    const task = findTask(doc, "1.1");
    expect(task.description).toBe("折り返しのある 説明文");
    expect(task.details).toEqual(["詳細"]);
  });

  it("ID を持たないチェックボックス行は raw フォールバックになる（13.2）", () => {
    const source = "- [ ] ID なしのタスク\n";
    const doc = parseTasks(source);
    expect(doc.tasks).toEqual([]);
    expect(doc.otherBlocks.some((block) => block.markdown.includes("ID なしのタスク"))).toBe(true);
    assertNoInformationLoss(source, doc);
  });

  it("タスクを含まない文書は全体が otherBlocks に入る（13.2）", () => {
    const source = "# 実装計画\n\n説明文。\n\n- 普通の bullet\n";
    const doc = parseTasks(source);
    expect(doc.tasks).toEqual([]);
    expect(doc.otherBlocks.length).toBeGreaterThan(0);
    assertNoInformationLoss(source, doc);
  });

  it("空文書は空の TasksDoc を返す", () => {
    const doc = parseTasks("");
    expect(doc.tasks).toEqual([]);
    expect(doc.otherBlocks).toEqual([]);
  });
});
