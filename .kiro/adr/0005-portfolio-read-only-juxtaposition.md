---
id: 5
title: 複数プロジェクトは読み取り専用の並置で束ねる（ポートフォリオビュー・会計の合成なし）
status: proposed
date: 2026-07-05
app: moira
specs: []
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0005: 複数プロジェクトは読み取り専用の並置で束ねる（ポートフォリオビュー・会計の合成なし）

> **status: proposed** — 本 ADR と D-73 は敵対検証ループ（doc-refine）未通過。
> 引き継ぎ手順は issue #23 の「検証ループ引き継ぎ」コメント参照。ループ通過＋人間批准で accepted へ。

## Context

issue #23（issue #15 適用ギャップ項目52）: 部門で複数案件を束ねる PM/PMO が、案件横断の
状況把握（各案件の EV/SPI/CPI・バッファ残・レビュー待ち）や、同じ人が複数案件に出ている
ときの掛け持ちを見たい。

正典側の制約: moira は「1プロジェクト＝1つの記録の家（home）」であり、
- **D-50**: 複数プロジェクト掛け持ちの容量合算はスコープ外（単一プロジェクト視点）
- **MODEL §5:433**: 複数プロジェクトにわたる Σc の整合はモデルのスコープ外（組織レベル管理の責務 = A4）
- **ADR-0003**: multi-repo ≠ multi-project — home 解決はどの経路でも 1 つしか返さない

つまり「束ねて見たい」という要求と「単一プロジェクト視点」という正典の境界を、
**境界を壊さずに**両立させる必要があった。エンジン（4イベント・fold・derive）と MODEL は変更不要。

## Decision

ポートフォリオを**提示層の読み取り並置**として実装する（ADR-0004 と同じ
「コアに触れない拡張」パターン）:

1. **宣言的な portfolio.json**（schemaVersion 1）が N 個の home を名指しする。
   各エントリは home root または `.moira` ポインタファイル（1 ホップ）。
   `moira ui --portfolio <file>` が配信の入口。
2. **各 home は 1 つずつ独立に解決・fold・derive** する。エントリごとに home.ts の
   `resolveExplicit` を 1 回呼ぶだけで、ログのマージ・イベント合流・複数 home を返す
   解決 API は存在しない（D-50/ADR-0003 の「1解決=1home」不変）。
3. **横断で合算するのは単位安全な件数のみ**（レビュー待ち件数・構造エラー数）。
   EV%/SPI/CPI の横断合成値は出さない — BAC も単位も案件ごとに異なり、重み付けは
   正典に持たない裁量パラメータの密輸になる。
4. **人横断ビューは Actor.id の文字列一致のみ**で束ねる（グローバル人物台帳は持たない）。
   同日複数案件マーカーは「取り合いの見える化」であって整合違反の判定ではない。
   容量整合の強制・平準化はせず、開示文言を常設する。宣言容量の合計は明示宣言分のみ
   （未宣言日を 1.0 と見なして合算しない）。
5. **読めない home はエラー行として可視**（ゼロの捏造禁止）。全 home が読めないときのみ起動失敗。
6. **統一 asOf**（`--asOf` > 各 home の config.asOf の最大 > 今日）で全案件を導出する（比較可能性）。
7. **ドリルダウンは既存の単一案件ダッシュボードの再マウント**（読み取り専用のまま）。
   並置の数値は単独ダッシュボードの数値と完全一致（INV-2 golden で機械固定）。

## Consequences

- エンジン（`moira/backend`）と MODEL.md は無改修（実装コミットの diff ゼロ）。
- 新しい機械ガード: depcruise `surfaces-read-via-hooks-not-store` が portfolio-store を
  対象に追加、fidelity gate の derive import 白リストに `portfolio-derive.ts` が追加
  （ポートフォリオモードの導出呼び出し点は 1 モジュールに固定）。
- 正直さの負債として開示するもの:
  - レビュー待ちの**最古経過日数**は未実装（「人間ゲート待ち」計器の導入時に追加予定・画面に注記済み）
  - 統一 asOf は「各 home が自分の config.asOf で見たときの絵」とはずれ得る（既定は max なので
    一部案件は自分の asOf より未来で導出される）— 敵対検証ループの急所として引き継ぎ済み
  - portfolio.json の home 追加・削除の fs.watch 反映は再起動が必要（ブラウザ再読込では反映される）
- シナリオ E2E（計器③/④）は人間の When/Then 種待ち（kiro-scenario → kiro-scenario-e2e）。
- 関連文書: D-73（DECISIONS-CATALOG）・`moira/UI-ARCHITECTURE.md`（PortfolioShell 節）・
  `moira/cli/README.md`・`moira/GETTING-STARTED.md`・issue #23（実装計画＋検証ループ引き継ぎ）。
