/**
 * SkillDocPage — スキル詳細画面（design.md「Feature: knowledge → SkillDocPage」/
 * requirements 6.2, 6.3, 6.6）。
 *
 * - ルートパラメータ `:name` のスキルを useSkillDoc で取得する。
 * - ヘッダにスキル名 + OriginBadge（origin 分類 / 6.6）を表示する。
 * - EN / JA タブで本文を切り替える。アクティブタブは URL クエリ ?lang=（en|ja、既定 en）で
 *   復元・共有可能（6.2）。本文は review-ui の MarkdownDoc で描画する。
 * - ja === null のスキルは JA タブを無効化し、非エラー文言「日本語版は未作成」を表示して
 *   EN 本文を出す（6.3）。?lang=ja でも ja=null なら EN へフォールバック（エラーにしない）。
 * - loading → LoadingSkeleton、error → ErrorPanel（code/message + 再試行 / 9.6）。
 *
 * 読取専用・ローカル完結。書込操作 UI・外部リンク・dangerouslySetInnerHTML を持たない。
 */
import type { JSX } from "react";
import { useParams, useSearchParams } from "react-router";

import { MarkdownDoc } from "@/markdown/MarkdownDoc";
import { ErrorPanel } from "@/shared/ErrorPanel";
import { LoadingSkeleton } from "@/shared/LoadingSkeleton";

import { useSkillDoc } from "@/workflow/api/useSkillDoc";

import { OriginBadge } from "./OriginBadge";

type Lang = "en" | "ja";

export function SkillDocPage(): JSX.Element {
  // ルート定義（/skills/:name）により name は常に存在する。
  const { name = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useSkillDoc(name);

  if (query.isPending) {
    return <LoadingSkeleton label={`スキル「${name}」を読み込み中…`} />;
  }
  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  }

  const doc = query.data;
  const jaAvailable = doc.ja !== null;

  // URL クエリの希望言語。ja=null のときは JA を選べず EN へフォールバックする（非エラー）。
  const requested: Lang = searchParams.get("lang") === "ja" ? "ja" : "en";
  const activeLang: Lang = requested === "ja" && jaAvailable ? "ja" : "en";

  const selectLang = (lang: Lang) => {
    if (lang === "ja" && !jaAvailable) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (lang === "en") {
      next.delete("lang");
    } else {
      next.set("lang", "ja");
    }
    setSearchParams(next);
  };

  const activeDoc = activeLang === "ja" && doc.ja !== null ? doc.ja : doc.en;

  return (
    <section data-testid="skill-doc-page" className="space-y-4 p-4">
      <header data-testid="skill-doc-header" className="flex items-center gap-3">
        <h1 className="text-[19px] font-bold">{doc.name}</h1>
        <OriginBadge origin={doc.origin} />
      </header>

      <div role="tablist" aria-label="言語" className="flex gap-2 border-b-2 border-line">
        <button
          type="button"
          role="tab"
          aria-selected={activeLang === "en"}
          onClick={() => selectLang("en")}
          className={`-mb-0.5 border-b-2 px-3 py-1.5 text-sm font-medium ${
            activeLang === "en"
              ? "border-brand text-ink"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          EN
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeLang === "ja"}
          aria-disabled={!jaAvailable}
          disabled={!jaAvailable}
          onClick={() => selectLang("ja")}
          className={`-mb-0.5 border-b-2 px-3 py-1.5 text-sm font-medium ${
            activeLang === "ja"
              ? "border-brand text-ink"
              : "border-transparent text-ink-soft hover:text-ink"
          } ${!jaAvailable ? "cursor-not-allowed opacity-50" : ""}`}
        >
          JA
        </button>
      </div>

      {!jaAvailable ? (
        <p data-testid="skill-ja-missing" className="text-sm text-ink-soft">
          日本語版は未作成
        </p>
      ) : null}

      <div data-testid="skill-doc-body">
        <MarkdownDoc doc={activeDoc} />
      </div>
    </section>
  );
}

export default SkillDocPage;
