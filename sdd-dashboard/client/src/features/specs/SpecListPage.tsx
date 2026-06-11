/**
 * スペック一覧画面（design.md ルート表 `/specs`、Requirement 1.1）。
 *
 * `useSpecs` の `SpecSummary[]` を変換せずそのまま列挙する:
 * - 各行: feature 名 + メタバッジ（SpecMetaBadges）+ 成果物有無バッジ + 診断バッジ
 * - spec.json 不正等の `diagnostics` を持つスペックも省略せず、診断バッジ付きで表示する
 * - 行全体が `/specs/:feature` への Link（URL がビュー位置の唯一の真実。書込 UI なし → 8.1）
 * - 読込中は LoadingSkeleton、失敗時は ErrorPanel + 再試行（Requirement 1.5）
 */
import type { JSX } from "react";
import { Link } from "react-router";
import type { ArtifactName, SpecSummary } from "@contracts/spec";
import { useSpecs } from "@/api/useSpecs";
import { SpecMetaBadges } from "@/features/specs/SpecMetaBadges";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

/** 成果物バッジの表示順（@contracts/spec ArtifactName の全種別） */
const ARTIFACT_ORDER: readonly ArtifactName[] = [
  "brief",
  "requirements",
  "design",
  "tasks",
  "research",
  "validationGap",
  "validationDesign",
  "validationImpl",
];

/** 成果物の有無バッジ列。不在はエラーではなくディム表示（Requirement 1.3 と同じ非エラー方針） */
function ArtifactBadges({ artifacts }: { artifacts: SpecSummary["artifacts"] }): JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {ARTIFACT_ORDER.map((name) => {
        const available = artifacts[name];
        return (
          <span
            key={name}
            data-testid={`artifact-${name}`}
            data-state={available ? "available" : "missing"}
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${
              available
                ? "border-slate-300 bg-white text-slate-700"
                : "border-slate-200 bg-slate-50 text-slate-300 line-through"
            }`}
          >
            {name}
          </span>
        );
      })}
    </span>
  );
}

function SpecRow({ spec }: { spec: SpecSummary }): JSX.Element {
  return (
    <li data-testid={`spec-row-${spec.feature}`}>
      <Link
        to={`/specs/${spec.feature}`}
        className="block rounded-md border border-slate-200 bg-white p-3 hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span data-testid="spec-feature" className="font-medium text-slate-900">
            {spec.feature}
          </span>
          <SpecMetaBadges summary={spec} />
          {spec.diagnostics.length > 0 && (
            <span
              data-testid="diagnostics-badge"
              className="inline-flex items-center rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-800"
            >
              診断 {spec.diagnostics.length} 件
            </span>
          )}
        </span>
        <span className="mt-2 block">
          <ArtifactBadges artifacts={spec.artifacts} />
        </span>
      </Link>
    </li>
  );
}

export function SpecListPage(): JSX.Element {
  const specs = useSpecs();
  return (
    <section data-testid="spec-list-page">
      <h1 className="text-lg font-semibold">スペック一覧</h1>
      {specs.isPending && <LoadingSkeleton label="スペック一覧を読み込み中…" />}
      {specs.isError && (
        <ErrorPanel
          error={specs.error}
          onRetry={() => {
            void specs.refetch();
          }}
        />
      )}
      {specs.data !== undefined && (
        <ul className="mt-4 space-y-2">
          {specs.data.map((spec) => (
            <SpecRow key={spec.feature} spec={spec} />
          ))}
        </ul>
      )}
    </section>
  );
}
