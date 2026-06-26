---
name: decision-conformance
description: >-
  moira/DECISIONS-CATALOG.md の設計判断のうち自動テストに落とせないもの（計器⑥AI整合性チェック）を、
  独立 checker で「Decision↔実装」整合（conformance）を検証する設計。本機構は**定義済・実走は後続**。
  「設計判断と実装の整合をチェック」「Decisions の conformance を回す」「目録と実装がズレていないか確認」で起動。
  validity（判断の妥当性）は人間レビュー/doc 敵対ゲートの役割で本スキルは扱わない。Opus 4.8+ / effort max を推奨。
allowed-tools: Read, Grep, Glob, Bash, Agent, AskUserQuestion
model: opus
metadata:
  origin: "custom"
---

# decision-conformance — 設計判断↔実装の整合を独立 checker で検証する（定義・実走は後続）

`moira/DECISIONS-CATALOG.md` の設計判断のうち、**自動テストに落とせない判断（計器⑥）**——および基盤未整備で①②③④のテストがまだ無い領域——について、
**判断が実装で守られているか（held か破れているか＝conformance）**を、独立した `decision-conformance-checker` で検証する。
**validity（その判断が妥当か）は扱わない**——それは人間レビューと `doc-refine` 敵対ゲートの役割。本スキルは **conformance（held か）**のみを falsifiable に示す。
**現状は定義のみ（実走は後続ステージ）。** 採点ゲートの主体は未確定の設計点（後述）。

**この英語ファイルは規約シェル。完全な規範手順は [`SKILL.ja.md`](./SKILL.ja.md)**（プロジェクト言語）にある。二重正典を避けるため手順はここに複製しない——`SKILL.ja.md` に従う。
検証アーキテクチャ上の位置づけ（計器⑥は `moira-verification.md` の節「Decisions の検証割付」内）と被覆規律は `.kiro/steering/moira-verification.md`、計器割付の現物は `moira/DECISIONS-CATALOG.md` の被覆マップが正典。

一行で: 対象判断を被覆マップの計器⑥（＋テスト未整備の①②③④）から選ぶ → 照合対象（実装サーフェス）をユーザーに確定 → `decision-conformance-checker` を並列・独立に派遣（ALIGNED/DRIFTED/UNVERIFIABLE） → DRIFTED を集約し是正先（実装修正 or 目録訂正）にルーティング → 被覆マップの状態を更新。

## 既存スキルとの境界

- `code-review` / `simplify`: コードの diff をレビュー/整理する。
- `verify`: 実挙動でコード変更を確認する。
- `kiro-validate-impl` / `kiro-review`: タスク/機能の spec↔実装 整合を実装工程で見る（feature 粒度・`.kiro/specs/{feature}` 前提）。**本スキルとは SUT 粒度が違う**（本スキルは Decision 粒度・`moira/backend` 前提）。将来 kiro-validate-impl への組込みは検討課題だが、**現状 kiro-validate-impl 側に受け口は無く片方向**——組み込むなら受け側の改修が要る。
- `doc-refine`: 確定文書そのものを凍結前に堅くする（判断の **validity** を敵対ゲートで磨く）。
- **本スキル**: 確定済み設計判断（Decisions）が、その後も**実装で守られ続けているか（conformance）**を検証する。validity でなく drift を見る。
