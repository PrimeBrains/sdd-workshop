/**
 * BoardPage — パイプライン俯瞰ボード画面（design.md「Feature: board」BoardPage /
 * Requirements 1.1, 1.3, 1.4, 1.6, 1.7, 1.8, 9.6）。
 *
 * - `useSpecs` で全スペックを取得。読込中は LoadingSkeleton、エラー時は ErrorPanel + 再試行（9.6）。
 * - 成功時は `groupByApp` で app セクションに分割（app 名昇順・null は末尾「未分類」、1.6, 1.8）。
 * - 各セクションは AppSectionHeader（`summarizeSpecGroup` のサマリー、1.7）+ PipelineFlow
 *   （そのセクションのスペックのみで `buildBoardGraph`、1.1）を描画する。
 *
 * 読取専用。書込操作 UI・外部 URL を持たない。default export は board ルートの React.lazy 用。
 */
import type { JSX } from "react";

import { useSpecs } from "@/api/useSpecs";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { AppSectionHeader } from "@/workflow/board/AppSectionHeader";
import { PipelineFlow } from "@/workflow/board/PipelineFlow";
import { buildBoardGraph } from "@/workflow/board/buildBoardGraph";
import { groupByApp, summarizeSpecGroup } from "@/workflow/model/grouping";

/** 各セクションの PipelineFlow が jsdom / ブラウザでレイアウトできるよう、決定論的サイズの器を与える。 */
const SECTION_FLOW_HEIGHT = 360;

export function BoardPage(): JSX.Element {
  const specsQuery = useSpecs();

  if (specsQuery.isPending) {
    return <LoadingSkeleton label="ボードを読み込み中…" />;
  }

  if (specsQuery.isError) {
    return <ErrorPanel error={specsQuery.error} onRetry={() => void specsQuery.refetch()} />;
  }

  const groups = groupByApp(specsQuery.data);

  return (
    <section data-testid="workflow-board-page" className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-slate-800">Board</h1>
      {groups.map((group) => {
        const sectionKey = group.app ?? "未分類";
        const graph = buildBoardGraph(group.items);
        return (
          <section
            key={sectionKey}
            data-testid={`board-section-${sectionKey}`}
            data-app={group.app ?? ""}
            data-board-section="true"
            className="mb-8"
          >
            <AppSectionHeader app={group.app} summary={summarizeSpecGroup(group.items)} />
            <div
              data-testid={`app-section-flow-${sectionKey}`}
              style={{ height: SECTION_FLOW_HEIGHT, width: "100%" }}
              className="rounded-md border border-slate-200"
            >
              <PipelineFlow nodes={graph.nodes} edges={graph.edges} />
            </div>
          </section>
        );
      })}
    </section>
  );
}

export default BoardPage;
