---
created_at: 2026-06-25T00:00:00Z
title: 見積案を人間がレビューして承認し「合意済み（agreed）」にする受け入れシナリオを確定
bindings:
  - { kind: scenario, id: "units/estimate-spec-agreed" }
  - { kind: requirement, id: "moira-core: 4.2" }
  - { kind: requirement, id: "moira-core: 7.2" }
  - { kind: requirement, id: "moira-surface-spec-value: 4.1" }
  - { kind: requirement, id: "moira-surface-spec-value: 7.3" }
source: claude-code-session
---

## 要約

- **論点:** 前段ユニット [estimate-spec-proposed](../scenarios/units/estimate-spec-proposed.md)（見積案が「提案中（未承認）」として現れる）の続きとして、「AI が提案してきた見積を人間がレビューして OK なら承認する」ふるまいを受け入れシナリオ単位に起こし、敵対者ループを通して確定する。
- **§3（不可侵の人間意図・ユーザーが ratify）:** 開発者が提案中の見積案をレビューし問題ないと判断して承認する → 3ノード（要件定義・設計・タスク）の見積が「承認済み（合意済み）」に変わり、印が変わり、見積カバレッジが 0% から上がり、履歴に「見積を承認」行が増え、見積値が確定（凍結）され、実装は見積なしのまま。
- **決定（§7 に正典化）:**
  1. スコープは happy path（3葉一括承認）に限定。承認拒否（差し戻し→再見積 R-E3）と部分承認（ノード単位合意 §2.2）は将来の別ユニットへ切り出す。
  2. 承認 write の所有は `moira-estimate-agree`（⚠未実装・提案 `moira-estimate-propose` とは別スキル）。spec-value 画面は合意を自ら実行せず深リンクのみ（moira-surface-spec-value Req7 AC3）。
  3. 凍結は予算次元のみ（`frozenBudget`）。スロット凍結は初回スケジュール時で本ユニット対象外（MODEL §3 二次元）。
  4. **見積カバレッジ P2 はノード基底**（親 F を分母に含む）。F は I1 ロールアップで独立合意されないため、3葉すべて合意しても P2 = 3/4 = **75%**（100% でない）。出所＝参照実装 `coverage.ts`／ゴールデンテスト `coverage.test.ts`。
  5. 画面表現は参照実装 `SpecValueSurface.tsx` に接地。ノード木は `frozenBudget` を独立列に出さず EV寄与として現す。
  6. 見積カバレッジは「読むだけ・再計算しない」（Req9 AC2）。§6 EARS は「表示を更新」と表現。
  7. 履歴画面は前段で起票決定済みの新規アクティビティ画面。
- **理由:** §3 は人間が発案・ratify した不可侵の受け入れ基準であり、AI は接地・描き起こし・敵対検証に徹する。確定値・接地は MODEL v17／引用 spec／参照実装で独立に裏取りし、独立採点者（doc-gate-judge）の falsifiable ゲート PASS（生存 Critical/Important = 0）を得てから draft→agreed に上げた。

### 覆った判断（履歴）

- **見積カバレッジ P2 の分母:** 当初「葉基底（有効葉 3）→ 3葉合意で 100%」と描いた。Round 1 の fact-checker が「MODEL P2 字義は『既知ツリーの全ノード』」と指摘。著者は一旦「I1 により葉に帰着するので葉基底・ESCALATE 不要」と §7 に書いて**葉基底のまま 100% を維持**した。→ **Round 2 敵対者が参照実装 `coverage.ts`（分母 `effectiveNodes.size`・親を含む）とゴールデンテスト `coverage.test.ts:28`（`F + a 合意 → 1/2`）を提示し、葉基底判断が canon と正面衝突する Critical を検出。** 著者は coverage.ts/coverage.test.ts を自分で読んで検証し、**P2 はノード基底（親 F 含む）、正値は 75%（3/4）**へ全面訂正（§2=0/4、§4=75%、§7#4 書換）。「葉基底なのは scheduleCoverage/executionCoverage のみ、estimateCoverage はノード基底」という canon 設計を確認。
- **承認を担う skill:** 当初 §3 注で「`moira-estimate-propose` が見積提案と同一パスで合意も尋ねる」と記述。→ fact-checker と敵対者が moira-surface-spec-value Req7 AC3「合意 write は `moira-estimate-agree`（提案とは別 skill）が所有、surface は深リンクのみ」を指摘。`moira-estimate-agree` へ訂正。
- **§4 の `frozenBudget` 独立列:** 当初ノード木に「凍結値: X人日」列を描いた。→ 参照実装 `SpecValueSurface.tsx` に凍結値の独立列は無く EV寄与算定にのみ使うと判明。列を削除し「見積／EV寄与」表示に、`frozenBudget` はデータ表の per-node 属性として残置。
- **§6 EARS の「P2 を再計算」:** 当初「システムは見積カバレッジ（P2）を…再計算しなければならない」。→ surface は「読むだけ・再計算しない」（Req9 AC2）に反するため「見積もり済みの割合の表示を…更新」へ、MODEL 記号 P2 も除去。
- **§4 Before の「提案あり 3/3 ノード」ラベル:** P2 をノード基底に訂正後も Before セルに旧・葉基底ラベルが残り分母が 3→4 に揺れて見えた（Round 3 指摘）。「0%（合意済みベース・0/4）／見積案 3 葉に提示済み」へ訂正。

## 生ログ（該当範囲）

- **あなた**: `@ .kiro\scenarios\units\estimate-spec-proposed.md の続きで、AIが提案してきた見積を人間がレビューしてOKになったら承認するというシナリオを作成したい`
- **Claude**: kiro-scenario 手順で進行。人間がふるまいを発案している（happy path 承認）と判定し、§3 の When/Then に忠実転記。境界（凍結＝frozenBudget、実装は対象外）を明示し ratify を求めた。
- **あなた**: 「はい、意図どおり」（§3 と補足境界を確定）。
- **Claude**: 接地の一次資料セット（MODEL v17 / moira-core / moira-surface-spec-value / types.ts / 前後ユニット）を AskUserQuestion で確認 → SOURCE_SET_CONFIRMED。`estimate-spec-agreed.md` を描き起こし（RENDER）。
- **Claude**: 敵対者 doc-adversary ×3 を並列派遣（Round 1）。承認 skill 誤り・frozenBudget 独立列・§6 の P2 記号と「再計算」・postcondition 担保漏れ・SC1 未処理ケースを検出。fact-checker が承認 skill・frozenBudget・P2 分母を CORRECTED。
- **あなた**: SC1 スコープ FORK に「別ユニットに切り出す（推奨）」と回答。
- **Claude**: 上記を修正パッチ。Round 2 敵対者が「P2=100%（葉基底）は canon 実装と矛盾、正値 75%（ノード基底）」という Critical を検出。
- **Claude**: `coverage.ts`／`coverage.test.ts` を自分で精読し検証。P2 をノード基底・75% に全面訂正。Round 3 敵対者が 75% を独立再導出で確認、残る Important（Before ラベルの分母揺れ）を指摘 → 訂正。
- **Claude**: doc-gate-judge が全基準充足を確認し **GATE PASS**。status を draft→agreed に確定し、本会話ログを保存。
