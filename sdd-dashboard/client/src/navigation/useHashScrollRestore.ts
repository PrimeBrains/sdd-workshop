/**
 * useHashScrollRestore — ルート読み込み時に URL ハッシュからフォーカス対象を復元して
 * スクロールする最小フック（tasks.md 3.2 / Requirement 3.9 / design.md JumpNavigation
 * 「ルート読み込み時は URL ハッシュからフォーカス対象を復元してスクロールする」）。
 *
 * 責務はディープリンク（リロード・共有 URL）の復元スクロールのみ。アンカー ID 規約
 * （anchors.ts）・ジャンプ実行 + ハイライト（useJump）・履歴（jumpHistory）は 5.2 が
 * 実装し、本フックと合成する。スクロール挙動は useJump と同じ
 * `scrollIntoView({ block: "center" })` に揃える。
 *
 * アンカー不在時は何もしない（黙認）。ジャンプ操作としての不在フォールバック
 * （3.10 / ドキュメント先頭 + notice）は useJump（5.2）の責務。
 */
import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * @param ready フォーカス対象がドキュメント内に描画済みであること（データ到着後に true）。
 *              false の間はスクロールせず、true への遷移後に 1 回だけ実行する。
 */
export function useHashScrollRestore(ready: boolean): void {
  const { hash } = useLocation();

  useEffect(() => {
    if (!ready || hash === "" || hash === "#") {
      return;
    }
    const anchorId = decodeURIComponent(hash.slice(1));
    // 明示的に window.document を参照する（ルートパラメータ `document` との取り違え防止）
    const target = window.document.getElementById(anchorId);
    target?.scrollIntoView({ block: "center" });
  }, [ready, hash]);
}
