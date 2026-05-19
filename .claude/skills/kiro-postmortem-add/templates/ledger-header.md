# 不具合要因分析 Ledger

> AI 駆動の開発作業で発生した不具合 1 件ごとに 10 項目を記録する **追記型 Markdown ledger**。
> `/kiro-postmortem-add` で append、`/kiro-postmortem-review` で集約分析。
> 抽出された Try は `/kiro-steering-custom` 経由で `.kiro/steering/*.md` に反映する PDCA 基盤。
>
> 仕様の正典: `.kiro/specs/defect-pdca/{requirements,design}.md`

---

## PDCA 運用ガイド

本 ledger は Plan → Do → Check → Act のサイクルで運用する。

| Phase | Skill / 操作 | 起動者 | タイミング |
|---|---|---|---|
| **Plan** | `/kiro-postmortem-add` 起動 | AI (能動提案) または ユーザー | 不具合発覚直後 (root cause が明確になった時点) |
| **Do** | 10 項目を対話補完して ledger に append | ユーザー (AI ドラフト提案) | Plan に続けて即時 |
| **Check** | `/kiro-postmortem-review` 起動 | ユーザー (主体)、AI は提案者 | 後述の 4 トリガー条件のいずれか |
| **Act** | 抽出された Try を `/kiro-steering-custom` で steering 化 | ユーザー (AI 補助) | Check の結果として |

### Check の起動トリガー (R9.5)

`/kiro-postmortem-review` は以下のいずれかで起動を推奨する:

| ID | Trigger | 検出契機 |
|---|---|---|
| (a) | `spec-completion` | `/kiro-impl <feature>` 完了直後 (tasks がすべて `[x]`) |
| (b) | `cluster-threshold` | 未レビューエントリ内で同じ `根本要因分類` または `要因分類` が 2 件以上に達した |
| (c) | `new-spec-init` | `/kiro-spec-init <新 spec>` で新規 spec を開始する直前 (過去 Try を steering 反映してから新規 spec の要件作成に入るため) |
| (d) | `user-explicit` | ユーザーが明示的に振り返りを要求した (他条件の有無に関わらず常時許容) |

AI は (a) / (b) / (c) を検出時に 1 行で提案する。`(d)` は AI 提案不要。AI は **ユーザー確認なしで `/kiro-postmortem-review` を起動しない**。

---

## Entry スキーマ (10 項目)

各エントリは以下 10 項目をすべて埋める。空項目があれば `/kiro-postmortem-add` は append を拒否する。

| # | 項目 | 形式 |
|---|---|---|
| 1 | 発生機能 | 発生機能タクソノミーから 1 ラベル + 任意のサブスコープ (例: `dashboard / SummaryStrip`) |
| 2 | 発生した不具合 | 具体的な記述 (1-3 段落) |
| 3 | 検知した工程 | 検知工程タクソノミーから 1 ラベル |
| 4 | 検知すべき工程 | 検知工程タクソノミーから 1 ラベル |
| 5 | 検知すべき工程で検知できなかった理由 | 非空 (項目 3 と 4 が等しい場合は "該当なし (同工程で検知)" 可) |
| 6 | 要因分類 | 要因分類タクソノミーから 1 ラベル |
| 7 | 根本要因分類 | 根本要因分類タクソノミーから 1 ラベル |
| 8 | 根本要因詳細 | 「なぜそのメカニズムが発動したか」の具体的記述 |
| 9 | 同件調査 | 過去エントリ ID を `#0003, #0007` 形式で列挙、または "該当なし" |
| 10 | 次回からの対応策 | Try 候補 (steering 化される元ネタ) |

各エントリは以下のメタデータも保持する:
- `Status:` (recorded / reviewed / steered)
- `Entry ID:` (zero-padded 4-digit int, e.g. `0001`)
- `Created:` (ISO 8601 timestamp)
- `Source:` (`organic` / `retrospective-seed`)

---

## Status 状態遷移

| Status | 意味 | 遷移先 |
|---|---|---|
| `recorded` | `/kiro-postmortem-add` で記録された直後・未レビュー | `reviewed` or `steered` |
| `reviewed` | `/kiro-postmortem-review` で Try 抽出されたが steering 反映されなかった (却下 or 不要判定) | `steered` (後続の review で再評価された場合) |
| `steered` | Try が `/kiro-steering-custom` 経由で steering に反映済み | (終端) |

状態は各エントリの H3 タイトル直下の `Status:` 行で表現。`/kiro-postmortem-review` のみが `Edit` で書き換える。

---

## タクソノミー (4 軸)

### 要因分類タクソノミー (R3 / What 軸 — 欠陥が宿る成果物)

| Label | 定義 |
|---|---|
| `requirements-error` | 要件文書自体に誤り・抜け・矛盾・実装詳細混入 |
| `design-error` | 設計判断の誤り・抜け・整合性なし |
| `impl-error` | 要件・設計通りでなくコード実装が誤り |
| `env-config` | 環境設定 / 構成の不整合 (DB パス / 環境変数 / Node バージョン等) |
| `data-state-dep` | テスト間 / 環境間の状態残存・変動 |
| `tooling-fragility` | ライブラリ / ツールの仕様や挙動に依存した脆さ |
| `external-dependency` | 外部サービス・パッケージの破壊的変更・非互換 |
| `other` | 上記いずれにも明確に分類不可 |

### 検知工程タクソノミー (R4 / Where 軸 — 検証層)

V モデルに従う: 実装ミス → `unit-test`、設計ミス → `integration-test`、要件ミス → `e2e`。

| Label | 定義 | 主に検知すべき成果物 |
|---|---|---|
| `code-review` | PR コードレビュー (人間による静的検証) | 命名・hardcoded constant・暗黙の前提 |
| `unit-test` | 関数・モジュール単体テスト (Vitest 等) | `impl-error` |
| `integration-test` | 複数モジュール統合テスト | `design-error` / `env-config` の一部 |
| `e2e` | エンドツーエンドテスト (Playwright 等) | `requirements-error` / 表示と API の整合 |
| `manual-verification` | 手動回帰確認・QA 目視 | 視覚的・体感的検証 |
| `production` | 本番運用中の検知 (監視 / ログ / アラート) | 性能劣化・低頻度エッジケース |
| `user-report` | ユーザー報告 (最後の砦) | (全層をすり抜けた状態) |

**ギャップ解釈**: `検知した工程 ≠ 検知すべき工程` の差が「すり抜けた検証層」を示す。例: `検知すべき = unit-test` かつ `検知した = user-report` は「ユニットテスト層がすり抜けた」を意味する。

### 発生機能タクソノミー (R13 / Spec 軸)

| Label | 定義 |
|---|---|
| `core-data-model` | `.kiro/specs/core-data-model/` 配下が責務 |
| `evm-engine` | `.kiro/specs/evm-engine/` 配下 |
| `progress-tracking` | `.kiro/specs/progress-tracking/` 配下 |
| `dashboard` | `.kiro/specs/dashboard/` 配下 |
| `defect-pdca` | `.kiro/specs/defect-pdca/` 配下 (本スペック自身) |
| `seed` | DB シード関連 (`server/seeds/`) |
| `e2e` | エンドツーエンドテスト (`evm-studio/e2e/`) |
| `formatters` | 表示フォーマッタ純関数 (細粒度) |
| `tooling` | 開発ツールチェーン (Vite / Vitest / Playwright / Node version 等) |
| `other` | 上記いずれにも該当しない / 未定義領域 |

サブスコープは `/` 区切りで自由記述可: `dashboard / SummaryStrip`, `core-data-model / seed`。

### 根本要因分類タクソノミー (R14 / Why 軸 — 失敗メカニズム)

| Label | 定義 |
|---|---|
| `assumption-error` | 「自明」「不要」と前提誤認した結果のミス |
| `knowledge-gap` | 仕様 / ライブラリ / ドメインの理解不足 |
| `context-loss` | 周辺情報・過去の決定・関連箇所の見落とし |
| `verification-gap` | 検証手段そのものを整備していなかった |
| `pattern-misapplication` | 別ドメイン / 別文脈のパターンを誤って流用 |
| `spec-impl-mismatch` | 仕様文と実装意図のズレ |
| `tooling-trap` | ツール / ライブラリの既知の落とし穴 |
| `state-management-gap` | テスト間 / セッション間の状態を見落とす |
| `boundary-violation` | spec / モジュール / レイヤの責務境界を越えた |
| `process-skip` | レビュー / テスト / 検証の省略判断 |
| `other` | 上記いずれにも明確に分類不可 |

要因分類 (What) と根本要因分類 (Why) は **直交軸**。任意の組み合わせが有効。

---

## (What × Why) Quick Reference Map

| 要因分類 (What) | よく合わさる Why | 検知すべき検証層 |
|---|---|---|
| `impl-error` | `assumption-error` / `pattern-misapplication` / `process-skip` | `unit-test` |
| `design-error` | `knowledge-gap` / `context-loss` / `boundary-violation` | `integration-test` |
| `requirements-error` | `spec-impl-mismatch` / `assumption-error` | `e2e` |
| `env-config` | `context-loss` / `state-management-gap` | `integration-test` |
| `data-state-dep` | `state-management-gap` | `integration-test` / `e2e` |
| `tooling-fragility` | `tooling-trap` / `knowledge-gap` | `e2e` |
| `external-dependency` | `knowledge-gap` / `tooling-trap` | `integration-test` / `e2e` |

詳細とラベル該当例は `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` を参照。

---

## タクソノミーの拡張ポリシー

タクソノミー外のラベルを記録したい場合、`/kiro-postmortem-add` が以下フローで対応する:
1. 既存タクソノミーを候補として提示
2. 既存ラベルを選ぶ or 「同一操作の中で本ヘッダのタクソノミー定義表に新ラベルを追加」を選ぶ
3. 拡張時は `.kiro/specs/defect-pdca/requirements.md` と `.claude/skills/kiro-postmortem-add/rules/taxonomy-reference.md` も同時更新する (3 ファイル同期、source of truth ルール)

---

## 例エントリ

以下は `#0001` seed エントリの再掲。新規エントリを作成する際の構造的リファレンス。

```markdown
### 0001: SummaryStrip / Inspector の BAC/EV/PV/AC が常に 0.0 MD と表示される単位スケール混入

Status: recorded
Entry ID: 0001
Created: 2026-05-18T16:00:00Z
Source: retrospective-seed

#### 1. 発生機能
`dashboard / formatters`

#### 2. 発生した不具合
プロジェクト全体のサマリーで BAC / EV / PV / AC が常に "0.0 MD" 表示...

#### 3. 検知した工程
`user-report`

#### 4. 検知すべき工程
`unit-test`

#### 5. 検知すべき工程で検知できなかった理由
formatters.test.ts が存在せず、設計書 Testing Strategy が「自明だから省略」と明記...

#### 6. 要因分類
`impl-error`

#### 7. 根本要因分類
`assumption-error`

#### 8. 根本要因詳細
「MD = Man-Day なら 1_000_000 で割らないはず」を「自明な変換」と判断...

#### 9. 同件調査
該当なし

#### 10. 次回からの対応策
ピュア関数の単位契約はテストで明示する。設計書で「自明だから省略」を見たら疑う...
```

(本 ledger の `## Entries` セクションに seed として #0001-#0003 が登録済み)

---

## Entries

(`/kiro-postmortem-add` がここに追記する。初回作成時は seed-entries.md の 3 件が埋め込まれる)

---

## Steering 反映ログ

(`/kiro-postmortem-review` が承認された Try を `/kiro-steering-custom` で反映した際、本セクション末尾に append する。形式は `### {timestamp}` ブロックで `Source entries:` / `Target steering:` / `Try summary:` を列挙。append-only)
