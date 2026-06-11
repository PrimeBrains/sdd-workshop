/**
 * CrosslinkJump — 相互リンクジャンプ（useJump 5.2）の実行と 3.10 フォールバックを、
 * ドキュメント切替を跨いで安定したページ（SpecDocumentPage）でホストする
 * （tasks.md 5.3 / Requirements 3.1, 3.2, 3.10 / design.md 相互リンクジャンプフロー）。
 *
 * 理由: RefChip はドキュメント本体の内側に置かれるため、クロスドキュメントのジャンプで
 * 遷移先ドキュメントへ切り替わると **RefChip 自身が unmount** する。ジャンプ実行・着地
 * （pending アンカー解決 + ハイライト）・アンカー未解決時の 3.10 フォールバック遷移を
 * RefChip がホストすると、unmount で着地・フォールバックが失われる。これらを
 * `/specs/:feature/:document` を担う安定したページでホストし Context で配布する。
 *
 * フォールバック（design.md 相互リンクジャンプフロー / 3.10）:
 * - design 対応先のアンカーが解決できない（useJump が resolved:false）→ design ビューの
 *   構造化トレーサビリティ行（`trace-row-<reqId>`）へ遷移（デッドクリックなし）
 * - その他の対応先 → ドキュメント先頭へ遷移し「対象位置を特定できなかった」notice を公開
 *
 * Provider 不在では RefChip ローカルのフォールバック付き実装を使う（単体テスト互換）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import type { NodeRef } from "@contracts/trace";
import type { DocumentKind } from "@/app/SpecActionSlot";
import { anchorIdOf } from "@/navigation/anchors";
import { useJump } from "@/navigation/useJump";

/** トレーサビリティ行アンカー（3.10 フォールバック着地点） */
export function traceRowAnchorId(requirementId: string): string {
  return `trace-row-${requirementId}`;
}

/** NodeRef の種別 → ドキュメント種別（ジャンプ先ルートの :document） */
export function documentOf(node: NodeRef): DocumentKind {
  switch (node.type) {
    case "requirement":
      return "requirements";
    case "design":
      return "design";
    case "task":
      return "tasks";
  }
}

/** 相互リンクジャンプの起点情報（3.10 フォールバックの要件 ID 算出に使う） */
export interface CounterpartJump {
  feature: string;
  /** ジャンプ先ノード */
  target: NodeRef;
  /** フォールバック用の要件 ID（design 対応先の trace-row-<reqId> 着地に使う） */
  requirementId: string;
}

export interface CrosslinkJumpApi {
  jumpToCounterpart(jump: CounterpartJump): void;
  /** その他対応先のアンカー未解決時に公開する notice（3.10） */
  notice: string | null;
  clearNotice(): void;
}

/**
 * useJump をラップし、3.10 フォールバックを内蔵する実装。Provider・ローカル両方で使う。
 */
function useCrosslinkJump(): CrosslinkJumpApi {
  const navigate = useNavigate();
  const { jumpTo, lastResolution } = useJump();
  const [notice, setNotice] = useState<string | null>(null);

  // 進行中ジャンプのフォールバック文脈。jumpTo の直前にセットし、lastResolution の
  // 解決後に 1 回だけ消費する。
  const pendingRef = useRef<CounterpartJump | null>(null);

  const jumpToCounterpart = useCallback(
    (jump: CounterpartJump) => {
      setNotice(null);
      pendingRef.current = jump;
      jumpTo({ feature: jump.feature, document: documentOf(jump.target), anchorId: anchorIdOf(jump.target) });
    },
    [jumpTo],
  );

  useEffect(() => {
    if (lastResolution === null || lastResolution.resolved) return;
    const pending = pendingRef.current;
    if (pending === null) return;
    pendingRef.current = null;

    if (pending.target.type === "design") {
      // design ビューの該当要件のトレーサビリティ行へフォールバック（デッドクリックなし → 3.10）
      navigate(
        `/specs/${encodeURIComponent(pending.feature)}/design#${encodeURIComponent(
          traceRowAnchorId(pending.requirementId),
        )}`,
      );
    } else {
      // その他: ドキュメント先頭へ遷移 + notice（黙って無視しない）
      navigate(`/specs/${encodeURIComponent(pending.feature)}/${documentOf(pending.target)}`);
      setNotice("対象位置を特定できなかったため先頭へ移動しました");
    }
  }, [lastResolution, navigate]);

  const clearNotice = useCallback(() => setNotice(null), []);
  return { jumpToCounterpart, notice, clearNotice };
}

const CrosslinkJumpContext = createContext<CrosslinkJumpApi | null>(null);

/** ページ単位で useCrosslinkJump を 1 インスタンス生成し配布する（SpecDocumentPage が包む） */
export function CrosslinkJumpProvider({ children }: { children: ReactNode }): JSX.Element {
  const api = useCrosslinkJump();
  return <CrosslinkJumpContext.Provider value={api}>{children}</CrosslinkJumpContext.Provider>;
}

/**
 * 配布された CrosslinkJump を取得する。Provider 不在では RefChip ローカルの実装にフォールバック
 * （フック規則のため両方を常に呼び、戻り値で分岐する）。
 */
export function useCrosslinkJumpFromContextOrLocal(): CrosslinkJumpApi {
  const contextApi = useContext(CrosslinkJumpContext);
  const localApi = useCrosslinkJump();
  return contextApi ?? localApi;
}
