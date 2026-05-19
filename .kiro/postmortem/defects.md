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

## Entries

### 0001: SummaryStrip / Inspector の BAC/EV/PV/AC が常に 0.0 MD と表示される単位スケール混入

Status: steered
Entry ID: 0001
Created: 2026-05-18T16:00:00Z
Source: retrospective-seed

#### 1. 発生機能
`dashboard / formatters`

#### 2. 発生した不具合
プロジェクト全体のサマリー (SummaryStrip) と Inspector の Task モードで BAC / EV / PV / AC のいずれも `0.0 MD` と表示されていたが、API レスポンスには正常値が含まれていた (例: BAC=70.0)。Server 側の計算ロジック (`calculateEvmMetrics`) は正しく稼働しており、Vitest テストも全て green だった。原因は `client/src/lib/formatters.ts:1` の `fmtMD = (n: number) => (n / 1_000_000).toFixed(1) + ' MD'` で、人日 (Man-Day) 単位の数値を不要に `1_000_000` で割っていた点。`70 / 1_000_000 = 0.00007` → `.toFixed(1)` で `'0.0'` 表示。

#### 3. 検知した工程
`user-report`

#### 4. 検知すべき工程
`unit-test`

#### 5. 検知すべき工程で検知できなかった理由
`client/src/lib/formatters.test.ts` 自体が存在しなかった。`dashboard/design.md` の旧 Testing Strategy セクションで「`lib/formatters.ts` の純関数群は自明な変換のみで、テストの ROI が低いため省略」と明記されており、検知層自体が設計レベルで省略されていた。さらに `dashboard/requirements.md` の旧 Requirement 4.7 が `(n / 1_000_000).toFixed(1) + ' MD'` を仕様レベルで埋め込んでいたため、レビューも素通りした。

#### 6. 要因分類
`impl-error`

#### 7. 根本要因分類
`assumption-error`

#### 8. 根本要因詳細
「MD = Man-Day なら 1_000_000 で割らないはず」という当然のセマンティクスを「自明な変換」と判断し、テストでアサートしなかった。バイト→MB のような別ドメインのスケール変換 (1_000_000 や 1024) と無意識に混同した可能性 (pattern-misapplication の側面もあり)。設計書で "自明だから省略" と書かれている箇所を疑う癖が欠けていた。

#### 9. 同件調査
該当なし (本件が初出 seed)

#### 10. 次回からの対応策
- ピュア関数の単位契約 (人日 / 時間 / 比率 / 金額等) はテストで明示する。具体的 boundary 値 (例: 70 → "70.0 MD") を assertion に書く
- 設計書で「自明だから省略」と書かれている箇所を見つけたら自動的に疑う
- 要件文書には実装詳細 (数式・割算定数) を埋め込まない。実装詳細は design に置く

---

### 0002: server runtime と seed が異なる DB ファイルを更新する不整合 + sqlite_sequence 累積

Status: steered
Entry ID: 0002
Created: 2026-05-18T16:30:00Z
Source: retrospective-seed

#### 1. 発生機能
`core-data-model / seed`

#### 2. 発生した不具合
`npm run seed` で投入される `projects.id` が 45-49 になり、`WorkbenchPage.tsx:81` がハードコードする `useState<number | null>(1)` と一致せず、`evm.calculate({projectId: 1})` が `Project not found` を返した。e2e シナリオ 2-9 が同一エラーで失敗。直接原因は 2 つの bug の合成: (1) `server/seeds/seed.ts` の `defaultDbPath` が `path.resolve(__dirname, '../../evm-studio.db')` で root の `evm-studio/evm-studio.db` を見ていたが、server runtime (`server/src/db/index.ts`) は cwd 起点で `./evm-studio.db` (= `server/evm-studio.db`) を見ていて DB ファイルが分裂。(2) seed が `db.delete(projects)` を呼んでも SQLite の `sqlite_sequence` テーブルがリセットされず、AUTO_INCREMENT 値が累積していた。

#### 3. 検知した工程
`e2e`

#### 4. 検知すべき工程
`integration-test`

#### 5. 検知すべき工程で検知できなかった理由
server runtime と seed の DB パス整合性を確認する integration-test が存在しなかった。「seed を流したら server がそのデータを読める」という基本契約をテストしていない。e2e で初めて顕在化したが、もっと小さい結合テストで `seed → server.evm.calculate({projectId: 1}) が成功する` をアサートしていれば即座に検知できた。

#### 6. 要因分類
`env-config`

#### 7. 根本要因分類
`context-loss`

#### 8. 根本要因詳細
seed.ts と server/src/db/index.ts の 2 ファイルが別々の関数で DB パスを解決していて、両方を同時に視野に入れる機会がなかった。それぞれを個別に読んだ際は妥当に見える。さらに SQLite の AUTOINCREMENT が `DELETE` ではリセットされないという仕様 (knowledge-gap の側面もあり) を把握しておらず、再 seed のたびに ID が累積することに気付かなかった。両 fact が組み合わさって初めて症状が出るタイプのバグ。

#### 9. 同件調査
該当なし (本件が初出 seed)

#### 10. 次回からの対応策
- spec / 環境設定をまたぐ「両側を同時に視野に入れる」レビュー観点を design.md の各 Boundary Commitments / Allowed Dependencies に書く
- 「同じリソース (DB / 環境変数 / ポート) を参照する箇所が複数ある場合、source of truth を 1 つにする」原則を steering 化する
- SQLite AUTOINCREMENT の挙動など、ライブラリ固有の落とし穴は知識として残す

---

### 0003: Playwright `getByText('EVM Studio')` が複数要素にヒットして strict mode violation

Status: steered
Entry ID: 0003
Created: 2026-05-18T17:00:00Z
Source: retrospective-seed

#### 1. 発生機能
`e2e / workbench`

#### 2. 発生した不具合
Phase 9 + 9.5 修正後、`workbench.spec.ts` の各シナリオが「正常データ描画後」に予期せぬセレクター衝突で fail した。例: `getByText('EVM Studio')` が TopBar の BrandMark の `<span aria-label>` と wordmark の `<div>` の 2 要素にマッチして strict mode violation。`text=EV` が "EVM STUDIO" にも合致して `readSummaryStat(page, 'EV')` が空文字を返す。修正前 (DB 不整合で UI が空表示の状態) は衝突要素が描画されず偶然 pass していた。

#### 3. 検知した工程
`e2e`

#### 4. 検知すべき工程
`e2e`

#### 5. 検知すべき工程で検知できなかった理由
該当なし (同工程で検知)。ただし「DB が正しく seed される + UI が正しく描画される」という前提条件が整って初めて顕在化したため、Phase 8 の e2e 整備時は無風状態で偽 pass だった。検証アサーションが「テキスト存在」止まりで「値の厳密一致」まで踏み込んでいなかったのが本質的弱点。

#### 6. 要因分類
`tooling-fragility`

#### 7. 根本要因分類
`tooling-trap`

#### 8. 根本要因詳細
Playwright の `text=` セレクターは **case-insensitive substring match** がデフォルト挙動。`getByText('EVM Studio')` は大小無視で部分一致するため、`<span>EVM STUDIO</span>` と `<div>EVM STUDIO</div>` の 2 つに合致して strict mode violation を起こす。ドキュメントを読めば防げる落とし穴だが、直感的には「完全一致」と勘違いしやすい。同様に `text=EV` が "EVM" に合致するのも同根。

#### 9. 同件調査
該当なし (本件が初出 seed)

#### 10. 次回からの対応策
- Playwright で e2e を書く際、テキストベースの locator は `getByTestId` / `data-testid` ベースに統一する
- 自動テスト用に `data-testid` を component に予め付与しておく (実装時に逆算)
- 一般原則: ツールの「直感的に見えるが厳密には違う」挙動 (text match の case-insensitive substring) はドキュメントを読んで明示的に学ぶ。tooling-trap は steering 化する
- 「データが正常描画される条件」が整って初めて顕在化するテストは fragile なので、テストフィクスチャの seed と UI 描画完了の同期点を明示する

---

## Steering 反映ログ

(`/kiro-postmortem-review` が承認された Try を `/kiro-steering-custom` で反映した際、本セクション末尾に append する。形式は `### {timestamp}` ブロックで `Source entries:` / `Target steering:` / `Try summary:` を列挙。append-only)

### 2026-05-19T14:30:00Z

- Source entries: #0001
- Target steering: `.kiro/steering/testing-conventions.md` (## 「自明」と判断したら疑う セクション)
- Try summary: 「自明な変換」と判断したら必ず疑い、最低 1 ケースのテストを書く / 要件文書に実装詳細を埋め込まない
- Handoff result: success

### 2026-05-19T16:00:00Z

- Source entries: #0002
- Target steering: `.kiro/steering/structure.md` (## Single Source of Truth セクション、append)
- Try summary: 同一リソース (DB パス / 環境変数 / ポート) を 1 箇所で定義し他は import 参照。CLI と server を跨ぐパスは絶対 or env で統一
- Handoff result: success

### 2026-05-19T16:00:00Z

- Source entries: #0002
- Target steering: `.kiro/steering/testing-conventions.md` (## データフロー結合テストを書く セクション)
- Try summary: `:memory:` パターンに頼らず、CLI ↔ server runtime ↔ API を跨ぐデータフロー結合テストを書く
- Handoff result: success

### 2026-05-19T16:00:00Z

- Source entries: #0003
- Target steering: `.kiro/steering/testing-conventions.md` (## 偽 pass を防ぐ セクション)
- Try summary: 厳密値アサート + 動的期待値 + データなし状態の fail 確認で偶然 pass を防ぐ
- Handoff result: success

> **Steering 集約方針 (2026-05-19 確定)**: PDCA Try は **大カテゴリの 1 ファイル** に H2 セクションとして集約 append する。新規ファイル作成は新しい大カテゴリが立つ時のみ。横並びの細粒度ファイル乱立を避け、`steering-principles.md` 規約「Patterns over lists / Single domain per file」と整合させる。詳細は `.kiro/skills/kiro-postmortem-review/SKILL.md` Step 8 参照。
