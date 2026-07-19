<!--
  影響マップ（P2 影響調査 の出力）テンプレート。append-only — 既存行の削除禁止。
  再入時（P4/P5 の未マップ差分検出・steering §4「再調査契機」）は末尾に行を追記する。誤りは状態列や
  備考で訂正し、行自体は残す。
  規範: .kiro/steering/moira-change-management.md（plan moira/plans/2026-07-19-change-management-dfd.md は来歴文書——規範は steering） §2 P2 行・§5（3値判定）・§6（人間断面ビュー）
  ・§6 提示規約に準拠。moira/changes/issue-N/impact-map.md として保存。
-->
---
status: working-ledger
issue: {{ISSUE}}
---

# 影響マップ — issue #{{ISSUE}}

## 波及先一覧

<!--
  各行は必須項目（steering §2 P2）: クラス・根拠・担当ゲート・期待 postcondition・検証器。
  根拠列: clause ID（MODEL の安定 A/I/P/R ID・行番号禁止）・DECISIONS-CATALOG 裏面 ref・
    PROPERTIES の clause→property 被覆・E2E spec の SPEC_META など、P2 が使うトレース機構
    （既存・新造なし）からの根拠を記す。ref-list は全列挙（範囲・ワイルドカード禁止 — trace-notation.md 準拠）。
  担当ゲート列: 既存 skill／検証器名（例: moira-model-update, doc-refine, kiro-scenario,
    kiro-scenario-flow, kiro-scenario-e2e, decision-conformance, /kiro-impl 等）。
  状態列: resolved | deferred | 未了 の3値＋証跡参照（steering §5）。
    - resolved: 期待 postcondition を検証器が確認した証跡（批准記録・テスト結果・照合 verdict・
      レビュー結果のいずれか）へのリンクを添える。コミットの存在だけでは resolved にできない
      （codex 指摘 #14）。
    - deferred: 追跡可能な後続 issue への参照＋owner＋再評価条件を持ち、かつその後続 issue が
      open で生きている場合のみ。単なる「理由付き見送り」は deferred の要件を満たさず未了。
    - 未了: 上記いずれも満たさない全て。1 行でも未了ならマップ全体として閉包不成立
      （P4 または P2 へ戻る）。
-->

<!-- 行 ID は R1, R2, … の連番で安定（append-only ゆえ再利用・欠番詰め禁止）。同一パスに複数の
     義務（別 postcondition・別検証器）があれば**別行**に起こす——閉包判定は行 ID 単位。
     パスはリポジトリルート相対のフルパス（例: moira/frontend/e2e/coverage-check.test.ts）。
     状態列は 3 値のみ・証跡は証跡列に分離する。 -->

| 行 ID | 波及先成果物（パス） | クラス | 根拠 | 担当ゲート | 期待 postcondition | 検証器 | 状態 | 証跡 |
|---|---|---|---|---|---|---|---|---|
| {{ROW_ID}} | {{PATH}} | {{CLASS}} | {{RATIONALE}} | {{GATE}} | {{POSTCONDITION}} | {{VERIFIER}} | {{STATE}} | {{EVIDENCE}} |

## 人間断面ビュー

<!-- steering §6 提示規約: 人間可読を最優先。3面＝シナリオ・プロパティ・設計判断の節と、
     「レビューしない」ソースコード・テストコードの節を分け、後者は対象外であることを冒頭に明示する。
     専門用語・skill 実名は前面の平易文には出さない（DECISIONS-CATALOG と同等の平易な言語規約）。 -->

### レビュー対象（シナリオ・プロパティ・設計判断の3面のみ）

<!-- 上記「波及先一覧」のうち M/D/P/S 級の行だけを、平易文で前面に提示する。
     M 級行は MODEL 条項文をそのまま出さず、D/P/S 粒度の平易文（判定文・一文・ふるまい例）へ
     翻訳して載せる（steering §3 M 行・§6 HA ④）。 -->

| 行 ID | 波及先 | 平易文（何が変わるか） | 状態 |
|---|---|---|---|
| {{ROW_ID}} | {{PATH}} | {{PLAIN_TEXT}} | {{STATE}} |

### 文書ゲート内で批准（HA 対象外）

<!-- F 級（一般確定文書）の行。人間タッチポイントは「文書により批准」＝ doc-refine ゲート内で
     決着する（steering §3 F 行）。HA の意図批准対象ではないことをここで明示する。 -->

| 行 ID | 波及先 | 批准の所在 |
|---|---|---|
| {{ROW_ID}} | {{PATH}} | doc-refine ゲート内 |

### 人間はレビューしない（codex＋CI に委譲）

以下は本フローの人間タッチポイント（HA・HB・H5）でのレビュー対象**ではない**——ソースコード・
テストコード（C級）・検証基盤（V級）等の機械決着行であり、codex レビューおよび CI
（計器①②③④）に委譲する。

<!-- 上記「波及先一覧」のうち C/V 級の行を畳んで一覧するだけでよい（詳細は波及先一覧を参照）。 -->

| 行 ID | 波及先 | クラス |
|---|---|---|
| {{ROW_ID}} | {{PATH}} | {{C_OR_V}} |
