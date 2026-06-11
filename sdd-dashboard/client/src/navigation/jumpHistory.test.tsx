/**
 * jumpHistory のテスト（tasks.md 5.4 / Requirement 3.4 / design.md JumpNavigation jumpHistory）。
 *
 * 純粋 reducer（push / pop の LIFO 遷移）と Context API（push → canGoBack / top / pop の復帰）を
 * 検証する。pop 後に同一出自が再 push されない（back ループ防止）ことは JumpBackBar 結合テスト側で
 * 統合的に検証する。
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { type JSX } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  jumpHistoryReducer,
  JumpHistoryProvider,
  useJumpHistory,
  type JumpOrigin,
} from "@/navigation/jumpHistory";

afterEach(cleanup);

const A: JumpOrigin = { feature: "feat", document: "requirements", anchorId: "req-1.2" };
const B: JumpOrigin = { feature: "feat", document: "design", anchorId: "design-x" };

describe("jumpHistoryReducer（純粋 LIFO スタック）", () => {
  it("push は末尾に積む", () => {
    const s1 = jumpHistoryReducer({ stack: [] }, { type: "push", origin: A });
    const s2 = jumpHistoryReducer(s1, { type: "push", origin: B });
    expect(s2.stack).toEqual([A, B]);
  });

  it("pop は末尾を除く", () => {
    const s = jumpHistoryReducer({ stack: [A, B] }, { type: "pop" });
    expect(s.stack).toEqual([A]);
  });

  it("空スタックの pop は無変化", () => {
    const s0 = { stack: [] as readonly JumpOrigin[] };
    expect(jumpHistoryReducer(s0, { type: "pop" })).toBe(s0);
  });
});

/** Context API を画面に映し出すプローブ */
function HistoryProbe(): JSX.Element {
  const { push, pop, canGoBack, top } = useJumpHistory();
  return (
    <div>
      <span data-testid="can-go-back">{String(canGoBack)}</span>
      <span data-testid="top">{top === null ? "none" : top.anchorId}</span>
      <button type="button" onClick={() => push(A)}>
        push-A
      </button>
      <button type="button" onClick={() => push(B)}>
        push-B
      </button>
      <button type="button" data-testid="popped" onClick={() => pop()}>
        pop
      </button>
    </div>
  );
}

describe("JumpHistoryProvider / useJumpHistory", () => {
  it("初期は canGoBack=false / top=none、push で canGoBack=true / top が直近に", () => {
    render(
      <JumpHistoryProvider>
        <HistoryProbe />
      </JumpHistoryProvider>,
    );
    expect(screen.getByTestId("can-go-back").textContent).toBe("false");
    expect(screen.getByTestId("top").textContent).toBe("none");

    act(() => {
      screen.getByRole("button", { name: "push-A" }).click();
    });
    expect(screen.getByTestId("can-go-back").textContent).toBe("true");
    expect(screen.getByTestId("top").textContent).toBe("req-1.2");

    act(() => {
      screen.getByRole("button", { name: "push-B" }).click();
    });
    expect(screen.getByTestId("top").textContent).toBe("design-x");
  });

  it("pop で直近の出自を取り除き、空になると canGoBack=false へ戻る", () => {
    render(
      <JumpHistoryProvider>
        <HistoryProbe />
      </JumpHistoryProvider>,
    );
    act(() => {
      screen.getByRole("button", { name: "push-A" }).click();
    });
    act(() => {
      screen.getByTestId("popped").click();
    });
    expect(screen.getByTestId("can-go-back").textContent).toBe("false");
    expect(screen.getByTestId("top").textContent).toBe("none");
  });

  it("Provider 不在では no-op（canGoBack=false・pop は null）", () => {
    render(<HistoryProbe />);
    expect(screen.getByTestId("can-go-back").textContent).toBe("false");
    act(() => {
      // push しても Provider 不在なので状態は変わらない
      screen.getByRole("button", { name: "push-A" }).click();
    });
    expect(screen.getByTestId("can-go-back").textContent).toBe("false");
  });
});
