/**
 * SkillListPage — スキル一覧画面（design.md「Feature: knowledge → SkillListPage」/
 * requirements 6.1, 6.4, 6.5）。
 *
 * - useSkillList の全スキルを groupSkillsByOrigin で「cc-sdd 標準 → 独自スキル → 未分類」の
 *   固定順 3 グループに分け（6.4）、各見出しに origin ラベル + 件数を併記する（6.5）。
 *   グルーピングは grouping.ts（唯一の導出点）に委ね、ここでは再グルーピングしない。
 * - 各スキルは /skills/:name への react-router Link で、hasEn/hasJa に応じた EN/JA バッジを付す（6.1）。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { Link } from "react-router";

import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { useSkillList } from "@/workflow/api/useSkillList";
import { groupSkillsByOrigin } from "@/workflow/model/grouping";

import { originLabel } from "./OriginBadge";

export function SkillListPage(): JSX.Element {
  const query = useSkillList();

  if (query.isPending) {
    return <LoadingSkeleton label="スキルを読み込み中…" />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const groups = groupSkillsByOrigin(query.data);

  return (
    <section data-testid="workflow-skill-list-page" className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-800">Skills</h1>
        <p className="text-sm text-slate-600">
          各スキルの説明を英語・日本語で参照できます。由来分類ごとに一覧化しています。
        </p>
      </header>

      {groups.map((group) => (
        <div key={group.origin ?? "unclassified"} data-testid="skill-origin-group" className="space-y-2">
          <h2 className="flex items-baseline gap-2 text-sm font-semibold text-slate-700">
            <span>{originLabel(group.origin)}</span>
            <span data-testid="skill-group-count" className="text-xs font-normal text-slate-500">
              {group.count}
            </span>
          </h2>

          <ul className="space-y-2">
            {group.skills.map((skill) => (
              <li key={skill.name} data-testid={`skill-item-${skill.name}`}>
                <Link
                  to={`/skills/${skill.name}`}
                  data-testid="skill-list-item"
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  <span>{skill.name}</span>
                  <span className="flex items-center gap-1">
                    {skill.hasEn ? (
                      <span
                        data-testid="skill-badge-en"
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600"
                      >
                        EN
                      </span>
                    ) : null}
                    {skill.hasJa ? (
                      <span
                        data-testid="skill-badge-ja"
                        className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600"
                      >
                        JA
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default SkillListPage;
