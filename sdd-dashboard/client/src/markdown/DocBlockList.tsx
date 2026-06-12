/**
 * DocBlockList — sdd-core の `DocBlock<T>` 配列を入力順のまま structured レンダラ /
 * RawBlockView へディスパッチする（design.md / Requirement 2.5）。
 *
 * 不変則: 並べ替え・スキップ・結合をしない。blocks の全要素が DOM に描画される
 * （位置連結 = 元文書全体というサーバー側不変則を表示でも保つ — 情報無欠落原則）。
 * キーは `position.startOffset`（文書内で一意・安定 — design.md Performance）。
 */
import { memo, type ReactNode } from "react";
import type { DocBlock } from "@contracts/document";
import { RawBlockView } from "@/markdown/RawBlockView";

/** `kind: "structured"` 側のブロック型（design.md Service Interface） */
export type StructuredBlock<T> = Extract<DocBlock<T>, { kind: "structured" }>;

export interface DocBlockListProps<T> {
  blocks: ReadonlyArray<DocBlock<T>>;
  renderStructured: (block: StructuredBlock<T>) => ReactNode;
}

interface StructuredItemProps<T> {
  block: StructuredBlock<T>;
  renderStructured: (block: StructuredBlock<T>) => ReactNode;
}

function StructuredItemInner<T>({ block, renderStructured }: StructuredItemProps<T>) {
  return <>{renderStructured(block)}</>;
}

/**
 * DocBlock 単位の memo 化（design.md Performance: 1,000 行超の design.md 対策）。
 * `memo` はジェネリクスを失うため、元の関数型へ戻すアサーションのみ行う。
 */
const StructuredItem = memo(StructuredItemInner) as typeof StructuredItemInner;

export function DocBlockList<T>({ blocks, renderStructured }: DocBlockListProps<T>) {
  return (
    <>
      {blocks.map((block) =>
        block.kind === "raw" ? (
          <RawBlockView
            key={block.position.startOffset}
            markdown={block.markdown}
            reason={block.reason}
            severity={block.severity}
          />
        ) : (
          <StructuredItem
            key={block.position.startOffset}
            block={block}
            renderStructured={renderStructured}
          />
        ),
      )}
    </>
  );
}
