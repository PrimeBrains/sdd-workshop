/**
 * TasksParser — tasks.md のチェックボックス行を TaskEntry 階層へ構造化する純粋関数。
 * （design.md Parser 層 TasksParser。Requirements 5.1, 5.2, 5.3, 5.4）
 *
 * 制約:
 * - FS アクセス禁止。入力は文字列のみ（MarkdownEngine / RefListParser との合成）
 * - `- [ ]` / `- [x]` / `- [ ]*` 行 → `{ id, description, checked, parallel, optional }`（5.1）。
 *   `(P)` は ID 直後の前置形・説明末尾の後置形の両方を受理する
 * - ID の `.` 有無で major / sub を判定し親子付けする（5.2）。親メジャー不在のサブは
 *   トップレベルに保持する
 * - `_Requirements:_` / `_Depends:_` / `_Boundary:_` 注記を抽出し（5.3）、参照文法の解釈は
 *   RefListParser へ委譲する。それ以外の詳細 bullet（未知注記 `_Blocked:_` 等を含む）は
 *   `details: string[]` に保持する（5.4）
 * - 情報無欠落不変則（13.2, 13.3): tasks（subtasks 込み）+ otherBlocks の position を
 *   連結すると元文書全体を隙間なくカバーする。タスクとして解釈できない行
 *   （非標準チェック状態 `[~]`・ID 無し等）は coverGaps の RawBlock で回収する
 */
import type { List, ListItem } from "mdast";
import type { TaskEntry, TasksDoc } from "../types/spec.js";
import type { RefToken } from "../types/trace.js";
import { coverGaps, nodeToPosition, parseMarkdown } from "./markdown.js";
import { parseRefList } from "./ref-list.js";

/** チェックボックス行: `- [x] ...` / `- [ ] ...` / `- [ ]* ...`（`*` は後送りマーカー） */
const TASK_LINE = /^[-*]\s+\[([ xX])\](\*)?\s+(.+)$/u;
/** タスク ID: major `1.` / `1`、sub `1.1` / `4.2a`（major のみ末尾ドットを許容） */
const TASK_ID = /^(\d+(?:\.[A-Za-z0-9]+)?)\.?\s+(.+)$/u;
/** ID 直後の前置並列マーカー（例: `3.4 (P) tasks パーサーを実装する`） */
const LEADING_PARALLEL = /^\(P\)\s+/u;
/** 説明末尾の後置並列マーカー（例: `デザイントークンを追加 (P)`） */
const TRAILING_PARALLEL = /\s*\(P\)$/u;
/** 既知注記 bullet: `_Requirements: ..._` / `_Depends: ..._` / `_Boundary: ..._` */
const ANNOTATION = /^_(Requirements|Depends|Boundary)\s*[::]\s*(.*?)_$/u;
/** 箇条書き先頭マーカー（raw スライスから本文を取り出す際に除去） */
const BULLET_MARKER = /^[-*]\s+/u;

/**
 * tasks.md ソースを TasksDoc へ変換する。
 * Postcondition: 例外を投げない。タスク行が 1 つも無い入力でも全内容が
 * otherBlocks（RawBlock）として返る。
 */
export function parseTasks(source: string): TasksDoc {
  const { tree } = parseMarkdown(source);

  // 1. トップレベルリストの各項目をタスクとして解釈する（文書順のフラット列）
  const flat: TaskEntry[] = [];
  for (const node of tree.children) {
    if (node.type !== "list") {
      continue;
    }
    for (const item of node.children) {
      const entry = buildTask(item, source);
      if (entry !== null) {
        flat.push(entry);
      }
    }
  }

  // 2. ID の `.` 有無で major / sub を判定し親子付けする（5.2）
  const tasks: TaskEntry[] = [];
  const majors = new Map<string, TaskEntry>();
  for (const entry of flat) {
    const dot = entry.id.indexOf(".");
    if (dot === -1) {
      majors.set(entry.id, entry);
      tasks.push(entry);
      continue;
    }
    const parent = majors.get(entry.id.slice(0, dot));
    if (parent === undefined) {
      tasks.push(entry); // 親メジャー不在のサブはトップレベルに保持（情報無欠落）
    } else {
      parent.subtasks.push(entry);
    }
  }

  // 3. タスクとして構造化されなかった範囲を RawBlock で回収する（13.2, 13.3）
  const otherBlocks = coverGaps(
    source,
    flat.map((entry) => entry.position),
    "タスク構造の外側のコンテンツ",
  );
  return { tasks, otherBlocks };
}

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * リスト項目 1 つを TaskEntry へ変換する（5.1, 5.3, 5.4）。
 * チェックボックス + 数値 ID の形式に一致しない項目は null を返し、
 * 呼び出し側の coverGaps が raw として回収する。
 */
function buildTask(item: ListItem, source: string): TaskEntry | null {
  const position = nodeToPosition(item);
  if (position === null) {
    return null;
  }

  // 見出し行 = 項目先頭〜最初の入れ子リスト直前（入れ子が無ければ項目末尾）
  const detailLists: List[] = [];
  let headEnd = position.endOffset;
  for (const child of item.children) {
    if (child.type !== "list") {
      continue;
    }
    const childPosition = nodeToPosition(child);
    if (childPosition === null) {
      continue;
    }
    detailLists.push(child);
    headEnd = Math.min(headEnd, childPosition.startOffset);
  }

  const head = normalizeText(source.slice(position.startOffset, headEnd));
  const line = TASK_LINE.exec(head);
  if (line === null) {
    return null; // 非標準チェック状態（[~] 等）は raw フォールバック
  }
  const idMatch = TASK_ID.exec(line[3] ?? "");
  if (idMatch === null) {
    return null; // 数値 ID を持たないチェックボックス行は raw フォールバック
  }

  let description = (idMatch[2] ?? "").trim();
  let parallel = false;
  if (LEADING_PARALLEL.test(description)) {
    parallel = true;
    description = description.replace(LEADING_PARALLEL, "");
  }
  if (TRAILING_PARALLEL.test(description)) {
    parallel = true;
    description = description.replace(TRAILING_PARALLEL, "");
  }

  const details: string[] = [];
  let requirements: RefToken[] = [];
  let depends: string[] = [];
  let boundary: string | null = null;
  for (const list of detailLists) {
    for (const bullet of list.children) {
      const bulletPosition = nodeToPosition(bullet);
      if (bulletPosition === null) {
        continue;
      }
      const text = normalizeText(
        source.slice(bulletPosition.startOffset, bulletPosition.endOffset),
      ).replace(BULLET_MARKER, "");
      const annotation = ANNOTATION.exec(text);
      if (annotation === null) {
        details.push(text); // 未知注記（_Blocked:_ 等）を含む詳細 bullet（5.4）
        continue;
      }
      const value = (annotation[2] ?? "").trim();
      switch (annotation[1]) {
        case "Requirements":
          requirements = [...requirements, ...parseRefList(value)];
          break;
        case "Depends":
          depends = [...depends, ...flattenDepends(parseRefList(value))];
          break;
        default:
          boundary = value;
      }
    }
  }

  return {
    id: idMatch[1] ?? "",
    description,
    checked: (line[1] ?? "").toLowerCase() === "x",
    parallel,
    optional: line[2] === "*",
    details,
    requirements,
    depends,
    boundary,
    position,
    subtasks: [],
  };
}

/**
 * `_Depends:_` の RefToken 列をタスク ID 列へ平坦化する。
 * 旧範囲表記は連番展開し、解釈不能トークン（自由記述等）は raw のまま保持する。
 */
function flattenDepends(tokens: RefToken[]): string[] {
  return tokens.flatMap((token) => {
    if (token.kind === "id") {
      return [token.id];
    }
    if (token.kind === "range") {
      return token.expanded;
    }
    return [token.raw];
  });
}

/** ソース折り返しの改行 + 継続インデントを単一スペースへ正規化する */
function normalizeText(text: string): string {
  return text.replace(/\r?\n[ \t]*/gu, " ").trim();
}
