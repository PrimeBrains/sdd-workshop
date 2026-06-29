<!--
初期 seed 3 件の body 草稿。
`/kiro-postmortem-add` の初回起動時 (ledger 不在時) に、`templates/ledger-header.md` を
展開した直後に本 3 件をそのまま `.kiro/postmortem/defects.md` の `## Entries` セクションに追加する。
各 entry は `templates/entry-template.md` の構造に従う。
-->

### 0001: SummaryStrip / Inspector の BAC/EV/PV/AC が常に 0.0 MD と表示される単位スケール混入

Status: recorded
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

Status: recorded
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

Status: recorded
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

<!-- end of seed-entries.md -->
