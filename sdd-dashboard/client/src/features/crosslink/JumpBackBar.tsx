/**
 * JumpBackBar — 相互リンクジャンプの「出自へ戻る」UI
 * （tasks.md 5.4 / Requirement 3.4 / design.md JumpNavigation jumpHistory・
 * 「RefChip + CounterpartPopover + JumpBackBar」・Integration Test #2）。
 *
 * jumpHistory の直近の出自（ルート + アンカー）をラベル表示し、「戻る」ボタンで
 * その出自（ドキュメント + アンカー位置）へ復帰する（3.4）。戻れる出自が無い
 * （canGoBack === false）ときは非表示。ブラウザの戻る / 進む（3.8 / 5.5）とは独立した
 * UI 内履歴であり、ドキュメント閲覧中に見える位置（SpecDocumentPage のドキュメント本体上部）に置く。
 *
 * 戻る操作は CrosslinkJump の `back()`（jumpHistory を pop → 再 push せず jumpTo）に委譲する。
 * 戻り操作自体は履歴を積まない（無限スタック防止は jumpHistory / JumpContext 側で担保）。
 */
import { type JSX } from "react";
import type { DocumentKind } from "@/app/SpecActionSlot";
import { useCrosslinkJumpFromContextOrLocal } from "@/navigation/JumpContext";
import { useJumpHistory, type JumpOrigin } from "@/navigation/jumpHistory";

/** 出自の人間可読ラベル（戻り先のドキュメント + アンカーを示す） */
export function jumpOriginLabel(origin: JumpOrigin): string {
  const documentLabel = DOCUMENT_LABELS[origin.document];
  return `${documentLabel} / ${origin.anchorId}`;
}

const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  brief: "brief",
  requirements: "requirements",
  design: "design",
  tasks: "tasks",
  research: "research",
};

export function JumpBackBar(): JSX.Element | null {
  const { back, canGoBack } = useCrosslinkJumpFromContextOrLocal();
  const { top } = useJumpHistory();

  // 戻れる出自が無いときは描画しない（3.4）
  if (!canGoBack || top === null) {
    return null;
  }

  return (
    <div
      data-testid="jump-back-bar"
      className="mb-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
    >
      <button
        type="button"
        data-testid="jump-back-button"
        onClick={() => back()}
        className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-700 hover:bg-slate-300"
      >
        ← 戻る
      </button>
      <span data-testid="jump-back-origin">戻る: {jumpOriginLabel(top)}</span>
    </div>
  );
}
