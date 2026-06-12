/**
 * DocumentView — DocumentKind ごとの構造化ビューアへの単一ディスパッチ
 * （tasks.md 6.1 のリファクタ点 / design.md File Structure Plan `features/viewer/`）。
 *
 * SpecDocumentPage（3.2/4.x）と ComparePane（6.1）が同一の `DocumentKind → ビューア`
 * ディスパッチを共有するために抽出した。両者でディスパッチが分岐しないよう、ここが唯一の所有者。
 *
 * - brief / research: MarkdownDoc（全文 + セクション。2.7 と同経路）
 * - requirements: RequirementsView（4.1）
 * - design: DesignView（4.2）
 * - tasks: TasksView（4.3）
 * - 不在成果物（null）は「未作成」の非エラー表示（Requirement 1.3 パターン）
 */
import { type JSX } from "react";
import type { SpecDetail } from "@contracts/spec";
import type { DocumentKind } from "@/app/SpecActionSlot";
import { DesignView } from "@/features/viewer/DesignView";
import { RequirementsView } from "@/features/viewer/RequirementsView";
import { TasksView } from "@/features/viewer/TasksView";
import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { cardClass } from "@/shared/ui";

export function DocumentView({
  kind,
  detail,
}: {
  kind: DocumentKind;
  detail: SpecDetail;
}): JSX.Element {
  switch (kind) {
    case "brief":
      return detail.brief !== null ? (
        <MarkdownDoc doc={detail.brief} />
      ) : (
        <MissingArtifact kind={kind} />
      );
    case "requirements":
      return detail.requirements !== null ? (
        <RequirementsView doc={detail.requirements} />
      ) : (
        <MissingArtifact kind={kind} />
      );
    case "design":
      return detail.design !== null ? (
        <DesignView doc={detail.design} />
      ) : (
        <MissingArtifact kind={kind} />
      );
    case "tasks":
      return detail.tasks !== null ? (
        <TasksView doc={detail.tasks} />
      ) : (
        <MissingArtifact kind={kind} />
      );
    case "research":
      return detail.research !== null ? (
        <MarkdownDoc doc={detail.research} />
      ) : (
        <MissingArtifact kind={kind} />
      );
  }
}

/** 不在成果物の非エラー表示（Requirement 1.3 パターン: 不在はエラーではない） */
export function MissingArtifact({ kind }: { kind: DocumentKind }): JSX.Element {
  return (
    <p
      data-testid="document-missing"
      className={`${cardClass()} text-sm text-ink-soft`}
    >
      {kind} は未作成です
    </p>
  );
}
