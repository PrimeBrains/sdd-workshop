/**
 * useJump — 相互リンクジャンプの実行フック
 * （tasks.md 5.2 / Requirement 3.3 / design.md JumpNavigation Service Interface）。
 *
 * `jumpTo(target)` は対象アンカーへ `scrollIntoView({ block: "center" })` し、~2 秒の
 * 一時ハイライトクラス（anchors.HIGHLIGHT_CLASS）を付与する。
 * - 同一ドキュメント内（feature + document 一致）: その場でスクロール + ハイライト
 * - 別ドキュメント: ルート + アンカーを URL ハッシュへ符号化して遷移し、遷移先 mount 後に
 *   ハッシュからフォーカス対象を解決してスクロール + ハイライトする（3.3 のジャンプ意味論。
 *   URL 履歴 nav state の本実装は 5.5、UI 内履歴 back は 5.4）
 * - アンカー不在（名称不一致）: throw せず `lastResolution = { resolved: false }` を返す。
 *   黙ってトップへスクロールしない。フォールバック（design 対応先 → トレーサビリティ行 /
 *   その他 → ドキュメント先頭 + notice）は呼び出し側（RefChip 5.3）が決める
 *
 * 範囲外（design.md JumpApi の `back` / `canGoBack`）: jumpHistory（5.4）の責務。本フックは
 * jumpTo + lastResolution に絞り、履歴 API はここでは提供しない（半端な実装を避ける）。
 *
 * useHashScrollRestore（3.2）はリロード・共有ディープリンクの復元専用で本フックと併存する
 * （責務分離）。本フックはジャンプ操作起点のハッシュ解決とハイライト付与を担う。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { HIGHLIGHT_CLASS } from "@/navigation/anchors";
import type { DocumentKind } from "@/app/SpecActionSlot";

/** ジャンプ着地時の一時ハイライト時間（ミリ秒） */
const HIGHLIGHT_DURATION_MS = 2000;

/** ジャンプ先（design.md JumpNavigation Service Interface の JumpTarget） */
export interface JumpTarget {
  feature: string;
  document: DocumentKind;
  anchorId: string;
}

/** アンカー解決結果（解決失敗を呼び出し側へ通知する） */
export interface JumpResolution {
  resolved: boolean;
}

/** useJump の公開 API（design.md JumpApi の jumpTo + lastResolution サブセット） */
export interface JumpApi {
  jumpTo(target: JumpTarget): void;
  lastResolution: JumpResolution | null;
}

/**
 * 対象アンカー要素へスクロールし一時ハイライトを付与する。
 * 要素が存在しなければ何もせず false を返す（黙ってトップへ動かさない）。
 *
 * @returns ハイライト除去タイマー ID（要素不在時は null）
 */
function focusAnchor(anchorId: string): { resolved: boolean; timer: ReturnType<typeof setTimeout> | null } {
  // 明示的に window.document を参照する（ルートパラメータ `document` との取り違え防止）
  const target = window.document.getElementById(anchorId);
  if (target === null) {
    return { resolved: false, timer: null };
  }
  target.scrollIntoView({ block: "center" });
  target.classList.add(HIGHLIGHT_CLASS);
  const timer = setTimeout(() => {
    target.classList.remove(HIGHLIGHT_CLASS);
  }, HIGHLIGHT_DURATION_MS);
  return { resolved: true, timer };
}

export function useJump(): JumpApi {
  const params = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [lastResolution, setLastResolution] = useState<JumpResolution | null>(null);

  const currentFeature = params.feature;
  const currentDocument = params.document;

  // ハイライト除去タイマー（アンマウント / 再ジャンプでクリーンアップしリークを防ぐ）
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // クロスドキュメント遷移後に解決すべきアンカー（遷移完了後の 1 回だけ消費する）
  const pendingAnchorRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const focus = useCallback(
    (anchorId: string): boolean => {
      clearTimer();
      const result = focusAnchor(anchorId);
      timerRef.current = result.timer;
      return result.resolved;
    },
    [clearTimer],
  );

  const jumpTo = useCallback(
    (target: JumpTarget) => {
      const sameDocument =
        target.feature === currentFeature && target.document === currentDocument;

      if (sameDocument) {
        const resolved = focus(target.anchorId);
        setLastResolution({ resolved });
        return;
      }

      // 別ドキュメント: ルート + ハッシュへ遷移し、遷移先 mount 後に解決する
      pendingAnchorRef.current = target.anchorId;
      navigate(`/specs/${target.feature}/${target.document}#${encodeURIComponent(target.anchorId)}`);
    },
    [currentFeature, currentDocument, focus, navigate],
  );

  // クロスドキュメント遷移の着地: 遷移後の hash 変化で保留アンカーを 1 回だけ解決する
  useEffect(() => {
    const pending = pendingAnchorRef.current;
    if (pending === null || hash === "" || hash === "#") {
      return;
    }
    const anchorId = decodeURIComponent(hash.slice(1));
    if (anchorId !== pending) {
      return;
    }
    pendingAnchorRef.current = null;
    const resolved = focus(anchorId);
    setLastResolution({ resolved });
  }, [hash, focus]);

  // アンマウント時にハイライト除去タイマーをクリーンアップ（リーク防止）
  useEffect(() => clearTimer, [clearTimer]);

  return { jumpTo, lastResolution };
}
