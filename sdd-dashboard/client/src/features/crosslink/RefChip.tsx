/**
 * RefChip — 参照トークン（RefToken）の表示とジャンプ起点の唯一の実装
 * （tasks.md 5.3 / Requirements 3.1, 3.2, 3.5, 3.6, 3.10 / design.md
 * 「RefChip + CounterpartPopover」Service Interface・相互リンクジャンプフロー）。
 *
 * kind 別の描画（design.md Responsibilities）:
 * - `id`        → 通常チップ。クリックで CounterpartPopover に TraceIndex 由来の対応先を一覧
 * - `range`     → legacy バッジ付き。展開 ID 群を個別チップとして描画（各 ID が対応先を持つ）
 * - `cross-spec`→ チップ。クリックで対象スペックの requirements ルート + アンカーへ遷移（3.6）
 * - `unparsable`→ 警告スタイルの非リンクチップ。raw をそのまま表示（対応先なし・ジャンプなし）
 *
 * ジャンプ意味論（design.md 相互リンクジャンプフロー）:
 * - 対応先の向きは origin から決まる:
 *   - origin が requirement の `id` トークン（AC の自 ID 等）→ `coverOf(id)`（design / task）（3.1）
 *   - origin が design / task の `id` トークン（参照している要件 ID）→ その要件へ（3.2）
 * - broken-link 診断に該当する参照・対応先はリンク切れスタイルで描画し、ジャンプを提供しない（3.5）
 * - design 対応先のアンカーが解決できない場合、design ビューの構造化トレーサビリティ行
 *   （`trace-row-<reqId>`）へフォールバック遷移する（3.10 — デッドクリックなし）。その他は
 *   ドキュメント先頭 + notice。ジャンプ実行・着地・フォールバックは CrosslinkJump（ページ単位
 *   ホスト）が所有する（クロスドキュメント遷移で RefChip 自身が unmount するため、JumpContext.tsx 参照）
 *
 * TraceIndex は TraceIndexContext から取得する。未取得（loading / Provider 不在）では素の
 * テキストチップを描画し crash させない（design.md「Handle trace-loading gracefully」）。
 */
import { useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router";
import type { NodeRef, RefToken, TraceDiagnostic } from "@contracts/trace";
import { anchorIdOf } from "@/navigation/anchors";
import { toDocumentKind } from "@/app/SpecActionSlot";
import { useCrosslinkJumpFromContextOrLocal } from "@/navigation/JumpContext";
import type { JumpTarget } from "@/navigation/useJump";
import type { TraceIndex } from "@/trace/traceIndex";
import { useTraceIndexContext } from "@/trace/TraceIndexContext";
import { badgeClass, chipClass } from "@/shared/ui";
import { CounterpartPopover, type CounterpartItem } from "./CounterpartPopover";

export interface RefChipProps {
  token: RefToken;
  /** チップが置かれている場所（診断照合・対応先の向き・ジャンプ履歴の出自に使用） */
  origin: NodeRef;
}

/** broken-link 診断: origin 位置で raw（参照表記）が一致するか */
function isBrokenRef(index: TraceIndex, origin: NodeRef, raw: string): TraceDiagnostic | null {
  for (const diagnostic of index.diagnosticsFor(origin)) {
    if (diagnostic.kind === "broken-link" && diagnostic.ref === raw) {
      return diagnostic;
    }
  }
  return null;
}

interface CounterpartPopoverGroups {
  designs: CounterpartItem[];
  tasks: CounterpartItem[];
  requirements: CounterpartItem[];
}

function emptyGroups(): CounterpartPopoverGroups {
  return { designs: [], tasks: [], requirements: [] };
}

/** NodeRef → 対応先項目（broken-link 診断を発生元位置で照合する） */
function toItem(index: TraceIndex, node: NodeRef): CounterpartItem {
  const label = node.type === "design" ? node.name : node.id;
  // 対応先ノード位置で当該参照が broken-link 診断に該当するか（リンク切れ表示・ジャンプ不可 → 3.5）
  for (const diagnostic of index.diagnosticsFor(node)) {
    if (diagnostic.kind === "broken-link" && diagnostic.ref === label) {
      return { node, label, broken: true };
    }
  }
  return { node, label, broken: false };
}

/**
 * id トークン（requirement ID）に対する対応先を origin の向きから算出する。
 * - origin=requirement: `coverOf(id)` → design / task（3.1）
 * - origin=design/task: その要件自身へ（3.2）
 */
function counterpartsForId(
  index: TraceIndex,
  origin: NodeRef,
  requirementId: string,
): CounterpartPopoverGroups {
  const groups = emptyGroups();
  if (origin.type === "requirement") {
    const cover = index.coverOf(requirementId);
    for (const edge of cover.designs) {
      groups.designs.push(toItem(index, edge.node));
    }
    for (const edge of cover.tasks) {
      groups.tasks.push(toItem(index, edge.node));
    }
  } else {
    // design / task 側のチップ: トークンが指す要件へジャンプする（3.2）
    groups.requirements.push(toItem(index, { type: "requirement", id: requirementId }));
  }
  return groups;
}

/**
 * 警告チップ（unparsable 用）: chipClass に warn variant が無いため、スケルトン .chip の
 * 形状に warn 系トークンを合わせて構成する（意味マッピング: amber-* → warn 系。3.2 / 5.1）。
 */
const WARN_CHIP =
  "inline-block font-mono text-[11px] px-[7px] rounded-md border mx-0.5 my-px cursor-default bg-warn-soft text-warn-ink border-warn-line";

export function RefChip({ token, origin }: RefChipProps): JSX.Element {
  const index = useTraceIndexContext();
  const navigate = useNavigate();
  // RefChip は同一スペック内に居る。jumpTo の起点 feature / document はルートパラメータ由来
  const params = useParams();
  const currentFeature = params.feature ?? null;
  const currentDocument = toDocumentKind(params.document);
  const { jumpToCounterpart, notice } = useCrosslinkJumpFromContextOrLocal();
  const [open, setOpen] = useState(false);

  // unparsable: 警告スタイルの非リンクチップ（raw そのまま・対応先なし・ジャンプなし）
  if (token.kind === "unparsable") {
    return (
      <span
        data-testid="ref-chip"
        data-ref-kind="unparsable"
        title="解釈できない参照表記"
        className={WARN_CHIP}
      >
        {token.raw}
      </span>
    );
  }

  // cross-spec: 対象スペックの requirements ルート + アンカーへ遷移（3.6）。TraceIndex 非依存
  if (token.kind === "cross-spec") {
    const feature = token.feature;
    const id = token.id;
    return (
      <button
        type="button"
        data-testid="ref-chip"
        data-ref-kind="cross-spec"
        onClick={() =>
          navigate(
            `/specs/${encodeURIComponent(feature)}/requirements#${encodeURIComponent(
              anchorIdOf({ type: "requirement", id }),
            )}`,
          )
        }
        className={chipClass("default")}
      >
        {token.raw}
      </button>
    );
  }

  // range（legacy）: 展開 ID 群を個別の id チップとして描画 + legacy バッジ。
  // 各展開 ID は通常の id トークンと同じ対応先・ジャンプを持つ。
  if (token.kind === "range") {
    return (
      <span data-testid="ref-chip-range" data-ref-kind="range" className="inline-flex flex-wrap items-center gap-1">
        {token.expanded.map((id) => (
          <RefChip key={id} token={{ kind: "id", id, raw: id }} origin={origin} />
        ))}
        <span
          data-testid="ref-chip-legacy-badge"
          title="旧範囲表記の展開（legacy）"
          className={badgeClass("gray")}
        >
          legacy
        </span>
      </span>
    );
  }

  // ここから kind === "id"
  const requirementId = token.id;

  // trace 未取得（index === null）: 素のテキストチップ（非インタラクティブ）。crash させない
  if (index === null) {
    return (
      <span
        data-testid="ref-chip"
        data-ref-kind="id"
        className={chipClass("plain")}
      >
        {token.raw}
      </span>
    );
  }

  // broken-link 該当: リンク切れスタイル（打消し + 警告色）。ジャンプを提供しない（3.5）
  const broken = isBrokenRef(index, origin, token.raw);
  if (broken !== null) {
    return (
      <span
        data-testid="ref-chip"
        data-ref-kind="id"
        data-broken="true"
        title="リンク切れ（対応先が見つかりません）"
        className={`${chipClass("danger")} line-through`}
      >
        {token.raw}
      </span>
    );
  }

  const groups = counterpartsForId(index, origin, requirementId);

  /** 対応先選択 → ジャンプ（着地・3.10 フォールバックは CrosslinkJump が所有） */
  function handleSelect(item: CounterpartItem): void {
    setOpen(false);
    if (currentFeature === null) return;
    // フォールバック用の要件 ID: origin が要件ならその ID、そうでなければ対応先 / トークンの要件 ID
    const fallbackReqId =
      origin.type === "requirement"
        ? origin.id
        : item.node.type === "requirement"
          ? item.node.id
          : requirementId;
    // ジャンプが departed-from する出自（現在のルート + origin チップのアンカー）。
    // back() でこの位置（ドキュメント + アンカー）へ復帰する（3.4）。現在ドキュメント不明時は履歴を積まない。
    const jumpOrigin: JumpTarget | undefined =
      currentDocument !== null
        ? { feature: currentFeature, document: currentDocument, anchorId: anchorIdOf(origin) }
        : undefined;
    jumpToCounterpart({
      feature: currentFeature,
      target: item.node,
      requirementId: fallbackReqId,
      origin: jumpOrigin,
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        data-testid="ref-chip"
        data-ref-kind="id"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={chipClass("default")}
      >
        {token.raw}
      </button>
      {open && (
        <CounterpartPopover groups={groups} onSelect={handleSelect} onClose={() => setOpen(false)} />
      )}
      {notice !== null && (
        <span data-testid="ref-chip-notice" role="status" className="ml-1 text-xs text-warn-ink">
          {notice}
        </span>
      )}
    </span>
  );
}
