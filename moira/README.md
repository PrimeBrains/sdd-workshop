# moira は専用リポジトリへ移転しました

**moira** は 2026-07-20 に、専用リポジトリ **https://github.com/PrimeBrains/moira** へ移転しました（issue #42）。

本リポジトリ（sdd-workshop）に置かれていた `moira/` 配下のソース・ドキュメント、および `.kiro/scenarios/`・`.kiro/adr/`・`.kiro/postmortem/` は削除済みです。以後の変更・参照は新リポジトリで行ってください。

新リポジトリはディレクトリ構造を維持しているため、旧パスと同一のパスで新リポジトリを参照できます。

## 旧パス → 新リポジトリ URL 対応表

| 旧パス（本リポジトリ） | 新リポジトリでの参照先 |
|---|---|
| `moira/MODEL.md` | https://github.com/PrimeBrains/moira/blob/main/moira/MODEL.md |
| `moira/PROPERTIES.md` | https://github.com/PrimeBrains/moira/blob/main/moira/PROPERTIES.md |
| `moira/PROPERTIES-RELEVANCE-REVIEW.md` | https://github.com/PrimeBrains/moira/blob/main/moira/PROPERTIES-RELEVANCE-REVIEW.md |
| `moira/DECISIONS-CATALOG.md` | https://github.com/PrimeBrains/moira/blob/main/moira/DECISIONS-CATALOG.md |
| `moira/DECISIONS.md` | https://github.com/PrimeBrains/moira/blob/main/moira/DECISIONS.md |
| `moira/backend/src/pbt/arbitraries.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/pbt/arbitraries.ts |
| `moira/backend/src/pbt/green-properties.pbt.test.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/pbt/green-properties.pbt.test.ts |
| `moira/backend/src/pbt/done-lock.pbt.test.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/pbt/done-lock.pbt.test.ts |
| `moira/backend/src/derivations/ev.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/derivations/ev.ts |
| `moira/backend/src/derivations/coverage.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/derivations/coverage.ts |
| `moira/backend/src/types.ts` | https://github.com/PrimeBrains/moira/blob/main/moira/backend/src/types.ts |
| `.kiro/scenarios/`（受け入れシナリオ集） | https://github.com/PrimeBrains/moira/tree/main/.kiro/scenarios/ |
| `.kiro/steering/moira-verification.md` | https://github.com/PrimeBrains/moira/blob/main/.kiro/steering/moira-verification.md |

上記はいずれも `https://github.com/PrimeBrains/moira/blob/main/<本リポジトリでの同一パス>` の形式（ディレクトリは `tree/main`）で新リポジトリを参照できます（新リポジトリは移転元と同じディレクトリ構造を維持しています）。

## 補足

- `.kiro/specs/moira-*` の要件・設計・タスク（R/D/T）アーカイブは、使い捨て成果物として本リポジトリに残置しています（#40 裁定）。
- 本リポジトリ側で open だった issue は、新リポジトリへ以下の通り移管されています。
  - #41 → moira#1
  - #38 → moira#2
  - #19 → moira#3
  - #15 → moira#4
