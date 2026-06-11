/**
 * useJump — 相互リンクジャンプの実行フック
 * （tasks.md 5.2 / Requirement 3.3 / design.md JumpNavigation Service Interface）。
 *
 * `jumpTo(target)` は対象アンカーへ `scrollIntoView({ block: "center" })` し、~2 秒の
 * 一時ハイライトクラス（anchors.HIGHLIGHT_CLASS）を付与する。
 * - フォーカス対象を URL（パス + ハッシュ）へ符号化し、ブラウザ履歴へ **push** で遷移する
 *   （5.5 / Requirement 3.7「ナビゲーション状態を URL に符号化」「jumpTo はブラウザ履歴 push」）。
 *   同一ドキュメント内・別ドキュメントを問わず `navigate(path#anchor)` で遷移するため、戻る /
 *   進む（popstate）で直前 / 直後のフォーカス状態を復元できる（Requirement 3.8）。
 * - 遷移後に hash 変化を捉え、保留アンカーを 1 回だけ解決してスクロール + ハイライトする。
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
      const targetPath = `/specs/${target.feature}/${target.document}`;
      const targetHash = `#${encodeURIComponent(target.anchorId)}`;
      const sameLocation =
        target.feature === currentFeature &&
        target.document === currentDocument &&
        hash === targetHash;

      // 同一ロケーション（同一パス + 同一ハッシュ）への再ジャンプは navigate で履歴が積まれず
      // hash 変化も起きないため、その場でフォーカスを解決する（戻る対象が増えないので push 不要）。
      if (sameLocation) {
        const resolved = focus(target.anchorId);
        setLastResolution({ resolved });
        return;
      }

      // フォーカス対象を URL（パス + ハッシュ）へ符号化しブラウザ履歴へ push する（3.7）。
      // 同一 / 別ドキュメントを問わず遷移し、遷移後の hash 変化で保留アンカーを解決する。
      // これにより戻る / 進む（popstate）で直前 / 直後のフォーカス状態を復元できる（3.8）。
      pendingAnchorRef.current = target.anchorId;
      navigate(`${targetPath}${targetHash}`);
    },
    [currentFeature, currentDocument, hash, focus, navigate],
  );

  // ジャンプ遷移の着地: 遷移後の hash 変化で保留アンカーを 1 回だけ解決する
  // （同一ドキュメント内ジャンプ・クロスドキュメントジャンプ共通の着地経路）。
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
