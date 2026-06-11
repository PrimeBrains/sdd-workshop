/**
 * CounterpartPopover — RefChip クリック時に TraceIndex 由来の対応先（design / task /
 * requirement）を一覧し、選択でジャンプ起点へ通知するアクセシブルなポップオーバー
 * （tasks.md 5.3 / Requirements 3.1, 3.2 / design.md「RefChip + CounterpartPopover」）。
 *
 * - design / task / requirement の種別ごとに対応先をグルーピングして一覧する（3.1, 3.2）
 * - broken-link 診断に該当する対応先はリンク切れスタイルで描画し、選択（ジャンプ）を
 *   提供しない（非ボタン化 → 3.5）
 * - アクセシビリティ: Esc で閉じる・外側クリックで閉じる・開いた直後に最初の項目へ
 *   フォーカスを移す（focus management）。role="dialog" + aria-label
 *
 * 本コンポーネントはジャンプ実行（useJump）を持たず、`onSelect(item)` で起点（RefChip）へ
 * 委譲する（ジャンプ意味論・3.10 フォールバックは RefChip が所有する単一経路にするため）。
 */
import { useEffect, useId, useRef, type JSX, type RefObject } from "react";
import type { NodeRef } from "@contracts/trace";

/** 対応先 1 件（ポップオーバーの選択肢） */
export interface CounterpartItem {
  /** ジャンプ先ノード（anchorIdOf で DOM アンカーへ変換する） */
  node: NodeRef;
  /** 表示ラベル（design 要素名 / requirement・task の ID） */
  label: string;
  /** broken-link 診断に該当する参照（リンク切れ。ジャンプ不可 → 3.5） */
  broken: boolean;
  /** broken-link の診断メッセージ（ある場合に表示） */
  brokenReason?: string;
}

export interface CounterpartPopoverProps {
  /** design / task / requirement 別の対応先一覧 */
  groups: {
    designs: CounterpartItem[];
    tasks: CounterpartItem[];
    requirements: CounterpartItem[];
  };
  /** 対応先選択（broken はコールされない）。RefChip がジャンプ意味論を実行する */
  onSelect(item: CounterpartItem): void;
  /** Esc / 外側クリック / 選択後に閉じる */
  onClose(): void;
}

const GROUP_LABELS: Record<keyof CounterpartPopoverProps["groups"], string> = {
  requirements: "要件",
  designs: "設計",
  tasks: "タスク",
};

const GROUP_ORDER: ReadonlyArray<keyof CounterpartPopoverProps["groups"]> = [
  "requirements",
  "designs",
  "tasks",
];

export function CounterpartPopover({ groups, onSelect, onClose }: CounterpartPopoverProps): JSX.Element {
  const dialogId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const isEmpty =
    groups.requirements.length === 0 && groups.designs.length === 0 && groups.tasks.length === 0;

  // 開いた直後に最初の項目へフォーカス（focus management）。項目が無ければコンテナへ。
  useEffect(() => {
    if (firstItemRef.current !== null) {
      firstItemRef.current.focus();
    } else {
      containerRef.current?.focus();
    }
  }, []);

  // Esc で閉じる + 外側クリックで閉じる
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    function onPointerDown(event: MouseEvent): void {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    window.document.addEventListener("keydown", onKeyDown, true);
    // 次の tick で登録し、ポップオーバーを開いた当のクリックで即閉じないようにする
    const timer = window.setTimeout(() => {
      window.document.addEventListener("mousedown", onPointerDown);
    }, 0);
    return () => {
      window.document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(timer);
      window.document.removeEventListener("mousedown", onPointerDown);
    };
  }, [onClose]);

  // フォーカスを当てる最初のボタン要素を 1 つだけ特定するためのフラグ
  let firstAssigned = false;
  function itemRefFor(broken: boolean): RefObject<HTMLButtonElement | null> | undefined {
    if (broken || firstAssigned) return undefined;
    firstAssigned = true;
    return firstItemRef;
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="対応先"
      aria-describedby={dialogId}
      tabIndex={-1}
      data-testid="counterpart-popover"
      className="absolute z-10 mt-1 min-w-48 rounded-md border border-slate-300 bg-white p-2 text-sm shadow-lg"
    >
      <p id={dialogId} className="mb-1 text-xs font-semibold text-slate-500">
        対応先
      </p>
      {isEmpty && (
        <p data-testid="counterpart-empty" className="px-1 py-0.5 text-slate-500">
          対応先がありません
        </p>
      )}
      {GROUP_ORDER.map((groupKey) => {
        const items = groups[groupKey];
        if (items.length === 0) return null;
        return (
          <div key={groupKey} className="mb-1 last:mb-0">
            <p className="px-1 text-xs font-semibold text-slate-400">{GROUP_LABELS[groupKey]}</p>
            <ul>
              {items.map((item) => (
                <li key={`${item.node.type}:${item.label}`}>
                  {item.broken ? (
                    <span
                      data-testid="counterpart-broken"
                      data-counterpart-kind={item.node.type}
                      title={item.brokenReason}
                      className="block px-1 py-0.5 font-mono text-xs text-rose-700 line-through"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <button
                      ref={itemRefFor(item.broken)}
                      type="button"
                      data-testid="counterpart-item"
                      data-counterpart-kind={item.node.type}
                      onClick={() => onSelect(item)}
                      className="block w-full rounded px-1 py-0.5 text-left font-mono text-xs text-sky-700 hover:bg-sky-50"
                    >
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
