/**
 * HelpPage — cc-sdd フロー解説画面（design.md「Feature: help」HelpPage /
 * requirements 4.1, 4.2, 4.3）。
 *
 * - フロー図: `FLOW_STEPS` を定義順に描画し、Discovery → Requirements → 承認 → Design → 承認 →
 *   Tasks → 承認 → 実装 の順序を示す（4.1）。
 * - フェーズ別カード: `PHASE_COMMANDS`（唯一の出典）の各エントリについて、成果物・承認の意味・
 *   CLI コマンドを表示する（4.2）。成果物名と CLI コマンドは PHASE_COMMANDS から読む。
 *
 * 読取専用・ローカル完結。外部リンク・外部画像・サーバ fetch・dangerouslySetInnerHTML を持たない。
 * 共通ナビからの到達性（4.3）はルート連結（routes.tsx / AppShell）で担保される。
 */
import type { JSX } from "react";

import { cardClass } from "@/shared/ui";
import { PHASE_COMMANDS } from "@/workflow/model/nextCommand";

import { FLOW_STEPS, PHASE_APPROVAL_MEANING } from "@/workflow/help/helpContent";

export { FLOW_STEPS } from "@/workflow/help/helpContent";

/** 「承認」ステップは中間ゲート、それ以外はフェーズ。見た目の区別用フラグ。 */
function isApprovalStep(label: string): boolean {
  return label === "承認";
}

export function HelpPage(): JSX.Element {
  return (
    <section data-testid="workflow-help-page" className="space-y-8 p-4">
      <header className="space-y-1">
        <h1 className="text-[19px] font-bold text-ink">cc-sdd ワークフローガイド</h1>
        <p className="text-[12.5px] text-ink-soft">
          Spec-Driven Development の開発フローと、各フェーズの成果物・承認の意味・CLI
          コマンドをまとめています。
        </p>
      </header>

      <section aria-labelledby="help-flow-heading" className="space-y-3">
        <h2 id="help-flow-heading" className="text-base font-semibold text-ink">
          フロー全体の順序
        </h2>
        <ol
          data-testid="help-flow-steps"
          className="flex flex-wrap items-center gap-2"
        >
          {FLOW_STEPS.map((label, index) => {
            const approval = isApprovalStep(label);
            return (
              <li
                key={`${label}-${index}`}
                className="flex items-center gap-2"
              >
                <span
                  data-testid="help-flow-step"
                  className={
                    approval
                      ? "rounded-full border border-warn-line bg-warn-soft px-3 py-1 text-sm font-medium text-warn-ink"
                      : "rounded-md border border-line bg-white px-3 py-1 text-sm font-medium text-ink"
                  }
                >
                  {label}
                </span>
                {index < FLOW_STEPS.length - 1 ? (
                  <span aria-hidden="true" className="text-ink-soft">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="help-phases-heading" className="space-y-3">
        <h2 id="help-phases-heading" className="text-base font-semibold text-ink">
          フェーズ別ガイド
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PHASE_COMMANDS.map((entry) => (
            <article
              key={entry.phase}
              data-testid={`help-phase-card-${entry.phase}`}
              className={`${cardClass()} space-y-2`}
            >
              <h3 className="text-sm font-semibold text-ink">{entry.phase}</h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    成果物
                  </dt>
                  <dd data-testid="help-phase-artifact" className="text-ink">
                    {entry.artifact}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    承認の意味
                  </dt>
                  <dd data-testid="help-phase-approval" className="text-ink-soft">
                    {PHASE_APPROVAL_MEANING[entry.phase] ?? ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                    CLI コマンド
                  </dt>
                  <dd>
                    <code
                      data-testid="help-phase-command"
                      className="rounded bg-fill-soft px-1.5 py-0.5 font-mono text-ink"
                    >
                      {entry.command}
                    </code>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export default HelpPage;
