/**
 * workflow-ui 向け操作スロット（design.md「AppShell + Router + SpecActionSlot」Service Interface）。
 *
 * sdd-workflow-ui が承認操作などの UI を差し込むための拡張点。Context ベースの
 * 登録 API（`register` → 戻り値が unregister）と、スペック画面ヘッダ右端に置く
 * 表示コンポーネント（`SpecActionSlotOutlet`）から成る。
 *
 * **本スペック（sdd-review-ui）は何も登録しない**（読み取り専用 → Requirement 8.1）。
 * UI 一時状態は Context に置く（design.md State Management の規律）。
 */
import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useMatches } from "react-router";

/** スペック成果物のドキュメント種別（design.md Service Interface） */
export type DocumentKind = "brief" | "requirements" | "design" | "tasks" | "research";

const DOCUMENT_KINDS: readonly DocumentKind[] = [
  "brief",
  "requirements",
  "design",
  "tasks",
  "research",
];

/** workflow-ui が操作 UI を差し込む際に受け取る描画コンテキスト */
export interface SpecActionContext {
  feature: string;
  /** 表示中ドキュメント（概要画面など document を持たないルートでは null） */
  document: DocumentKind | null;
}

export interface SpecActionSlotApi {
  /** 戻り値 = unregister。review-ui 自身は登録しない（8.1） */
  register(render: (ctx: SpecActionContext) => ReactNode): () => void;
}

interface Registration {
  readonly id: number;
  readonly render: (ctx: SpecActionContext) => ReactNode;
}

const ApiContext = createContext<SpecActionSlotApi | null>(null);
const RegistrationsContext = createContext<readonly Registration[]>([]);

let nextRegistrationId = 0;

/** AppShell が全画面を包む Provider。登録状態（UI 一時状態）を Context に保持する */
export function SpecActionSlotProvider({ children }: { children: ReactNode }): JSX.Element {
  const [registrations, setRegistrations] = useState<readonly Registration[]>([]);

  const api = useMemo<SpecActionSlotApi>(
    () => ({
      register(render) {
        const id = nextRegistrationId;
        nextRegistrationId += 1;
        setRegistrations((prev) => [...prev, { id, render }]);
        return () => {
          setRegistrations((prev) => prev.filter((entry) => entry.id !== id));
        };
      },
    }),
    [],
  );

  return (
    <ApiContext.Provider value={api}>
      <RegistrationsContext.Provider value={registrations}>
        {children}
      </RegistrationsContext.Provider>
    </ApiContext.Provider>
  );
}

/** 登録 API を取得する（workflow-ui のルートコンポーネントが利用する想定） */
export function useSpecActionSlot(): SpecActionSlotApi {
  const api = useContext(ApiContext);
  if (api === null) {
    throw new Error("useSpecActionSlot は SpecActionSlotProvider の内側でのみ使用できます");
  }
  return api;
}

function toDocumentKind(value: string | undefined): DocumentKind | null {
  return value !== undefined && (DOCUMENT_KINDS as readonly string[]).includes(value)
    ? (value as DocumentKind)
    : null;
}

/**
 * スロットの表示コンポーネント。AppShell のスペック画面ヘッダ右端に置く。
 * 描画コンテキストは URL（最深ルートマッチの params）から導出する:
 * feature を持たないルート（/specs 一覧等）では何も描画しない。
 */
export function SpecActionSlotOutlet(): JSX.Element | null {
  const registrations = useContext(RegistrationsContext);
  const matches = useMatches();
  const deepest = matches[matches.length - 1];
  const feature = deepest?.params["feature"];
  if (feature === undefined) return null;

  const ctx: SpecActionContext = {
    feature,
    document: toDocumentKind(deepest?.params["document"]),
  };

  return (
    <div data-testid="spec-action-slot" className="flex items-center gap-2">
      {registrations.map((entry) => (
        <Fragment key={entry.id}>{entry.render(ctx)}</Fragment>
      ))}
    </div>
  );
}
