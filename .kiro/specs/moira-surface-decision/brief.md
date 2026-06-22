# Brief — moira-surface-decision

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` の読/導出 spec 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) からトレースして起こした just-in-time brief。CQRS 分解の Wave3（surface 群、`[0d]` 後着手）。

## Problem
Moira 正典 MODEL v16 は「システムは観測・導出・警告に徹し、コミットメントを伴う判断は人間に残す」(§0/§2.1) を中核とするが、横断的に散らばる**警告と人間のコミット判断**を一望し、各々を解消する文脈ビュー（write）へ動線を引く面が、本番アーキとして spec 化されていない。MODEL は提示の下限（警告は acknowledge では消えない可視ギャップ §2.1・P0、判断待ち＝同一クエリの actor フィルタ P4）を既に強制し、UI-ARCHITECTURE §3 が層B `decision インボックス`（横断・行為のルーティング面）を派生設計したが、その消費契約（何を集約し・何を集約しないか／自前状態を持たないこと／行為列挙は導出層を読むだけであること／深リンクは再計算でなく参照であること）を要件として固定する spec が無い。

## Current State
- 正典: `moira/MODEL.md`(v16) — §2.1（警告は持続する導出・acknowledge 不在・5 コミット判断）・P0（コミット領域のみ・未コミットは可視ギャップ）・P4（三キューは同一クエリの actor フィルタ）・R-S2（導出群提供・警告再評価契機）・R-U9（可視ギャップ提示）・各警告条文（R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3・P5 at-risk）。
- 派生設計: `moira/UI-ARCHITECTURE.md` §3 で層B `decision インボックス`を「5 コミット判断のうち 4 つ＋判断・行為を要する警告を集約し各行から文脈ビューの write へ deep-link する read 派生のルーティング面・自前状態なし」、§4.2 で警告×集約×文脈ビュー（write）×消滅トリガーの対応表（判断型 8 件を inbox 集約・de-rate 型 R-S6 は非集約）、§5 で「新規（未確認）と据え置き・既知の区別表示（畳むが会計には残す P0・件数サマリ）」「各行は文脈ビューへ deep-link」「自前状態を持たない」、§6 で実装規律（層B は自前状態を持たない・deep-link は再計算でなく参照・選択肢列挙は導出層に一本化・横断判断は複数 deep-link 可・提示は会計から警告を除かない）を規定。
- 基盤契約: `.kiro/specs/moira-core/requirements.md`（生成済）が emit/derive・二層データ・R-S2 導出オーケストレータ・三キュー（P4 同一クエリ）の素地を所有。
- 上流: `.kiro/specs/moira-health/requirements.md`（生成済）が 9 警告の確定・集約・clearance（消滅トリガー）の単一定義・**行為列挙（取りうる行為）の単一定義（導出層に一度だけ）**・判断型/de-rate 型の区別・可視ギャップ会計からの除去禁止を所有。本 spec はこれを**読むだけ**。
- 参照実装（フォワード本番）: `moira/frontend/src/surfaces/inbox/DecisionInboxSurface.tsx`（8 行為警告＋コミット判断を集約・各行を write surface へ deep-link・自前状態なし／dismiss・seen・snooze ボタンを置かない・判断要件数サマリで会計算入を可視化・de-rate 型 R-S4/R-S6 は非集約）。`moira/backend`（derive の縦スライス）。

## Desired Outcome
MODEL v16 の「横断・行為（decision）」面を、health/core の導出を**読むだけ**の read-only ルーティング面として要件化する。具体的には:
- 判断・行為を要する警告（判断型 8 件）を decision インボックスへ集約して一望する（health が確定・集約したものを読む）。
- 5 コミット判断のうち 4 つ（見積合意・割当・スコープ/期日・見積の深さ）を、判断待ち＝同一クエリの actor フィルタ（P4）として集約する。第 5（c 宣言）は capacity·calendar config 面の責務なので集約対象外。
- 各行から、当該警告/判断を解消する文脈ビュー（write）へ **deep-link**（参照であって再計算でない）。横断判断（R-T4 等）は複数 deep-link を許す。
- 各警告の**詳細・次の行為・判断基準（取りうる行為列挙）**は、導出層（health）に一本化された単一定義を**読むだけ**で表示する（再定義・二重実装しない）。
- 「新規（未確認）」と「据え置き・既知」を区別表示（P0）。畳む・淡色化・並び替えはしてよいが、可視ギャップの会計（件数・リスト）から落とさない。
- 自前状態（dismiss/seen/snooze フラグ）を一切持たない。行為が追記され導出が再評価されると、条件が偽化した項目は自動的に消える。
- capacity heatmap は READ のみ（c の可視化を読むだけで、c 宣言の write は capacity config 面が所有）。

## Approach
read-only ルーティング面（UI-ARCHITECTURE §6 規律: 自前の真実源・可変状態・隠れキャッシュ・dismiss フラグを持たず、同一導出 R-S2 の read 派生フィルタに徹する）。警告の確定・集約・clearance・行為列挙の単一定義は **upstream `moira-health` が所有**し、本 spec はそれらを消費して集約提示・deep-link ルーティング・新規/据え置き区別・可視ギャップ会計の保持のみを要件化する。検出=読/解消=書の分離に従い、本 spec は警告を解消（write）しない（解消は write skill 群）。

## Scope
### In
- 横断・行為（decision）面の read 集約: 判断型 8 警告（R-U12/R-U13/R-T3/R-T4/R-S3/R-S7/R-C3・P5 at-risk）の集約一望（health の確定結果を読む）、5 コミット判断のうち 4 つ（見積合意・割当・スコープ/期日・見積の深さ）の判断待ち集約（P4 同一クエリ actor フィルタ）。
- 各行から文脈ビュー（write）への deep-link（複数 deep-link 可）。各警告の詳細・次の行為・判断基準（行為列挙の単一定義 by health）を読むだけで表示。
- 新規（未確認）と据え置き・既知の区別表示（P0・件数サマリで会計算入を可視化）。
- capacity heatmap = READ（c の可視化を読むのみ）。
- 自前状態なし（dismiss/seen/snooze 不在・条件偽化での自動消滅）。

### Out
- 9 警告の**検出述語/ロジック本体**・確定・集約・clearance の単一定義・**行為列挙の単一定義** = `moira-health`（本 spec は読む側）。検出側の述語本体 = 各 derivation（evm/schedule/scope-deps）。
- de-rate 型 R-S6/R-S4 の表出（常駐メトリクス修飾）= health/spec-value（inbox 非集約）。
- 全 write（見積合意 proposed→agreed・再見積・割当・スコープ/期日変更・再ベースライン・cancel・config 等の人間コミット行為）= moira-* write skill 群（reschedule/cancel-scope/estimate-agree/assign-schedule/project-config 等）。
- c 宣言の write・c(i,d) per-date 入力・理由付き改定 = capacity config 面 / capacity write skill（本 spec は heatmap を READ するのみ）。
- emit/derive・二層データ・R-S2 導出オーケストレータ・三キュー（P4）の導出 = `moira-core`（本 spec は消費）。
- 他軸の常駐ダッシュボード（spec-value/schedule-time/health）の提示 = 各 surface spec。

## Boundary Candidates
- 判断型 8 警告の集約一望 — 本 spec が host（提示）、確定・集約・行為列挙は `moira-health`。
- 4 コミット判断（判断待ち）の集約（P4 同一クエリ actor フィルタ）— 本 spec が host（提示）、キュー導出は core。
- 各行 → 文脈ビュー write への deep-link（複数可・参照のみ）— 本 spec。
- 新規/据え置き区別表示・可視ギャップ会計の保持（P0）— 本 spec（提示規律）。
- capacity heatmap READ — 本 spec（読むだけ）、c データ/履歴は二層データ（core）・write は capacity 面。

## Out of Boundary
- 警告の検出・確定・集約・clearance・行為列挙の単一定義、全 write（警告解消・コミット判断の実行・c 宣言）。これらは消費するのみで再定義・再計算・再実装しない（UI-ARCH §6・roadmap「検出=読/解消=書」「行為列挙は導出層に一本化」）。

## Upstream
- `moira-health` — 9 警告の確定・集約・clearance の単一定義・**行為列挙（取りうる行為）の単一定義**・判断型/de-rate 型の区別・可視ギャップ会計からの除去禁止を提供。本 spec はこれを読むだけ。
- （基盤）`moira-core` — R-S2 導出オーケストレータ・二層データ（c の heatmap データ）・三キュー（P4 同一クエリ actor フィルタ）・latest-wins・状態機械。

## Downstream
- なし（surface は読専用の末端）。本 spec は深リンクの**発信元**だが、着地先の文脈ビュー write は各 surface spec / write skill が所有し、本 spec はルーティングのみを担い責務を侵さない。

## Existing Spec Touchpoints
- `moira-core`（生成済・依存契約の消費元: R-S2 導出・三キュー P4・二層データ）。
- `moira-health`（生成済・直接の上流・本 spec が警告確定/集約/行為列挙を消費）。
- UI-ARCHITECTURE §3（層B decision インボックス）・§4.2（警告×集約×文脈ビュー deep-link×消滅トリガー）・§5（decision 構成・新規/据え置き区別・自前状態なし）・§6（自前状態なし・deep-link は参照・行為列挙の単一定義は導出層）。MODEL §2.1（警告持続・acknowledge 不在）。
- validation-scenarios: 各シナリオの判断面で「警告→行為（解消）」動線が decision インボックス経由で成立すること（S8 過負荷起点リスケ・S10 手戻り起点リスケ・S11 スコープ削除・S5 期日検算の R-T4 等）を横断的に参照。

## Constraints
- `moira/MODEL.md` v16 を SSOT として凍結遵守。MODEL の文言を変えず・新概念を足さず、提示の下限を MODEL からトレースする。
- read-only: 自前の真実源・可変状態・dismiss/seen/snooze フラグ・隠れキャッシュを持たない（UI-ARCH §6・§2.1 acknowledge 不在）。deep-link は再計算でなく参照（二系統計算禁止 P4）。
- 行為列挙（各警告の取りうる行為・判断基準）は導出層（health）に一本化された単一定義を読むだけ。本 spec で再定義・二重実装しない（UI-ARCH §6）。
- 提示は顕著さを抑制（畳む・淡色化・並び替え）してよいが、警告を可視ギャップの会計（件数・リスト）から除いてはならない（P0 falsifiable な線）。
- 検出=読/解消=書の分離: 本 spec は警告を解消（write）しない。
- capacity heatmap は READ のみ（c 宣言の write を持たない）。
- EARS は ja・`requirements-style.md` 準拠（英文＋和訳併記）。トレースは `trace-notation.md` 準拠。命名は `moira-naming.md` 準拠（コミット判断/コミット行為・可視ギャップ）。
- 本段は requirements.md のみ生成（design/tasks は後続）。
