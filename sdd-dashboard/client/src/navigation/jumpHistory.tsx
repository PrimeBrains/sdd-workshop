/**
 * jumpHistory — 相互リンクジャンプの「出自へ戻る」UI 内履歴スタック
 * （tasks.md 5.4 / Requirement 3.4 / design.md JumpNavigation「jumpHistory.ts」・JumpApi back/canGoBack）。
 *
 * ジャンプ実行の直前に「出自」（departed-from 位置 = ルート + アンカー）を push し、`back()` で
 * pop して復元する LIFO スタック。ブラウザの戻る / 進む（3.8 / 5.5）とは独立した UI 内履歴であり、
 * JumpBackBar（features/crosslink/JumpBackBar.tsx）に「戻る: <出自>」として表示される（3.4）。
 *
 * 出自は `JumpTarget`（feature + document + anchorId）として保持する。`back()` の復元は
 * jump host（CrosslinkJumpProvider）が pop した出自を **再 push せずに** jumpTo することで行う
 * （戻り操作自体が新たな履歴を積むと無限スタック / back ループになるため）。
 *
 * 状態（UI 一時状態）は design.md State Management の規律に従い reducer + Context に置く。
 * 純粋な reducer により push / pop の遷移をテスト可能にする。
 */
import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type JSX,
  type ReactNode,
} from "react";
import type { JumpTarget } from "@/navigation/useJump";

/** 履歴に積む出自（ジャンプが departed-from した位置: ルート + アンカー） */
export type JumpOrigin = JumpTarget;

interface JumpHistoryState {
  /** LIFO スタック。末尾が直近の出自（次に back() で戻る先） */
  readonly stack: readonly JumpOrigin[];
}

type JumpHistoryAction =
  | { type: "push"; origin: JumpOrigin }
  | { type: "pop" };

const INITIAL_STATE: JumpHistoryState = { stack: [] };

/** 純粋 reducer: push は末尾追加、pop は末尾除去（空なら無変化） */
export function jumpHistoryReducer(
  state: JumpHistoryState,
  action: JumpHistoryAction,
): JumpHistoryState {
  switch (action.type) {
    case "push":
      return { stack: [...state.stack, action.origin] };
    case "pop":
      if (state.stack.length === 0) return state;
      return { stack: state.stack.slice(0, -1) };
  }
}

/** jumpHistory の公開 API（jump host / JumpBackBar が利用する） */
export interface JumpHistoryApi {
  /** ジャンプ直前の出自を積む */
  push(origin: JumpOrigin): void;
  /** 直近の出自を pop して返す。空なら null（呼び出し側は再 push せず jumpTo する） */
  pop(): JumpOrigin | null;
  /** 戻れる出自があるか（JumpBackBar の表示可否 → 3.4） */
  canGoBack: boolean;
  /** 直近の出自（JumpBackBar のラベル表示用）。空なら null */
  top: JumpOrigin | null;
}

const JumpHistoryContext = createContext<JumpHistoryApi | null>(null);

/**
 * ジャンプ履歴スタックを 1 インスタンス生成し配布する。SpecDocumentPage が
 * CrosslinkJumpProvider と共にドキュメント切替を跨いで安定して包む。
 */
export function JumpHistoryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(jumpHistoryReducer, INITIAL_STATE);

  // pop は最新の stack を参照する必要があるため、stack を依存に含めて API を再生成する。
  const api = useMemo<JumpHistoryApi>(() => {
    const stack = state.stack;
    return {
      push(origin) {
        dispatch({ type: "push", origin });
      },
      pop() {
        if (stack.length === 0) return null;
        const origin = stack[stack.length - 1] ?? null;
        dispatch({ type: "pop" });
        return origin;
      },
      canGoBack: stack.length > 0,
      top: stack.length > 0 ? (stack[stack.length - 1] ?? null) : null,
    };
  }, [state.stack]);

  return <JumpHistoryContext.Provider value={api}>{children}</JumpHistoryContext.Provider>;
}

/**
 * 配布された jumpHistory を取得する。Provider 不在では戻れない no-op を返す
 * （JumpBackBar は canGoBack=false で非表示、jump host は push せず素のジャンプを行う）。
 */
export function useJumpHistory(): JumpHistoryApi {
  const api = useContext(JumpHistoryContext);
  if (api === null) {
    return { push: () => {}, pop: () => null, canGoBack: false, top: null };
  }
  return api;
}
