# Brief — moira-health

> 由来: `/kiro-discovery moira`（Path D 多 spec 分解）→ `.kiro/steering/roadmap.md` 確定版。本 brief は roadmap の `moira-health` 行を一次ソースに、`moira/MODEL.md`(v16, 凍結) 準拠で just-in-time 作成。
> 位置づけ: CQRS 分解の **Wave2**。下流 derivation（`moira-evm` / `moira-schedule` / `moira-scope-deps`）が検出した警告データを集約・確定し、各警告の取りうる**行為列挙**を導出層に単一定義する read=導出 spec。`moira-core` の emit/derive 契約を消費する。

## Problem
Moira 正典 MODEL v16 は「システムは観測・導出・警告に徹し、コミットメントを伴う判断は人間に残す」(§0/§2.1) を中核とする。9 種の警告(R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 + P5 at-risk)はいずれも**現在の導出状態に対する述語**であり、イベント追記時および構成入力(c・期日・目標日)の変更時に再評価され、条件が真の間だけ可視ギャップとして持続する(§2.1 警告持続)。しかし本番アーキへ落とす際、(1) これら警告の**確定・集約・clearance(消滅トリガー)が単一の責務として凍結されていない**——各検出述語が下流 derivation に分散しているため、警告の「現在状態判定」「acknowledge 不在」「可視ギャップ会計からの除去禁止」という横断規律を一箇所で保証する spec が無い。(2) 各警告の**取りうる行為の列挙**(R-T4 の3択・R-U13 の3択・R-C3 の3行動 等)が、surface-decision / evm-digest など複数の読み手で二重実装される恐れがある(UI-ARCH §6 規律)。この単一定義が無いと「二つの真実」(導出の乖離)を招く。

## Current State
- 参照実装(プロト)では `moira/frontend/src/moira/warnings.ts`(`computeInbox`) が現行 projected/derived 状態を述語として読み、4 つの判断型警告(R-U12 矛盾合意・R-U13 未合意完了・P5 at-risk・R-C3 キャンセル孤児)と 2 つの commit 判断(合意・割当)を**保存せず**列挙している(条件が偽化すれば次の derive で消える=dismiss/seen を持たない)。de-rate 型(R-S4/R-S6)はここに入れず health/spec-value のメトリクス修飾に置く、と冒頭コメントが規律を明記。
- ただしこれは「判断型警告の inbox 集約の縦スライス」であり、**9 警告すべての確定・集約・clearance の正式凍結・行為列挙の単一定義・要件トレース(R-* → 実装)は未確定**。R-T3/R-T4/R-S3/R-S6/R-S7 等スケジュール/EVM 起因の警告は本 spec が依存する下流 derivation 側に検出データがある。
- UI-ARCHITECTURE §4.2(警告9×消滅トリガー)・§6(選択肢列挙は導出層に一本化) が提示の下限と規律を確定済みだが、それを満たす導出契約は本 spec が確定する。

## Desired Outcome
`moira-health` は次を所有する:
1. **9 警告の確定・集約** — 下流 derivation(evm/schedule/scope-deps)が出す検出データを受けて、各警告を**現在状態の述語**として確定し集約する(8 件は decision インボックスへ集約、R-S6 は de-rate 型ゆえ inbox 非集約=health 常駐メトリクス修飾。計 9 件すべてに host)。
2. **clearance(消滅トリガー)の単一定義** — 各警告が「条件を偽化する入力(4 イベント追記 または 構成入力 c/期日/目標日 変更)」でのみ消えること、acknowledge(イベント無し)では消えないこと、を §2.1 準拠で確定。
3. **行為列挙の単一定義** — 各警告の取りうる行為(辺除去/付替/cancel 等)を導出層に一度だけ定義し、下流(surface-decision/evm-digest)が読むだけにする(UI-ARCH §6)。
4. **acknowledge 不在・可視ギャップ会計の保証** — 警告を可視ギャップの会計から除いてはならない(P0 falsifiable な線)。顕著さ制御(畳む/淡色化/並び替え)は提示の自由だが会計除去は不可。

## Approach
- MODEL を SSOT として、参照実装 `warnings.ts` の seam に design を整合させる。各**検出ロジック自体**は各導出 spec が所有し(roadmap Boundary Strategy「warning 述語: 検出データは各 derivation、警告確定/集約は moira-health」)、本 spec は検出データを**集約・確定**する責務に徹する。
- `moira-core` の derive 契約(同一ログ・同一実装で再現する R-S2 導出群)を消費し、自前の真実源・可変状態を持たない(layer 間に隠れたキャッシュを置かない)。
- 警告は**現在の導出状態への述語**として導出する(歴史的事実そのものではない)。R-U12=現行 latest-wins 値の actor 間不一致、P5 at-risk=implemented 再到達前、R-T4=導出スケジュールが現行期日超過、等は MODEL §2.1/各 R-* の現在状態判定に従う。

## Scope
### In
- 9 警告(R-U12/R-U13/R-T3/R-T4/R-S3/R-S6/R-S7/R-C3 + P5 at-risk)の**確定・集約**(検出データの受け口)。
- 各警告の**消滅トリガー(clearance)**の単一定義(§2.1 準拠: 条件偽化入力でのみ消滅・acknowledge では消えない)。
- 警告を**現在の導出状態に対する述語**として導出(イベント追記時 AND 構成入力変更時の再評価; R-S2)。
- **行為列挙(取りうる行為)の単一定義**(導出層に一度だけ; UI-ARCH §6)。
- 判断型(8 件)を集約対象とし、de-rate 型(R-S6)を集約対象外=常駐メトリクス修飾として区別する規律。
- 可視ギャップ会計からの除去禁止(P0)・acknowledge/dismiss/seen 可変状態の不在(最小性)の保証。

### Out
- 各警告の**検出ロジック/述語の所有** → 各導出 spec:
  - R-T3 過負荷・R-T4 期日超過・R-S6 SPI de-rate・R-S7 スロット陳腐化 の検出データ → `moira-schedule`。
  - R-S3 thrashing の検出データ → `moira-evm`(EV_abs/AC)。
  - R-C3 キャンセル孤児の依存辺評価 → `moira-scope-deps`(辺・orphan)。
  - R-U12 矛盾合意・R-U13 未合意完了・P5 at-risk の基礎状態(agreed 値・lifecycle・reachedImplemented) → `moira-core`(状態機械/projected)。
- emit/derive/二層データ・effective-set・latest-wins・状態機械・凍結記録 の **契約定義** → `moira-core`(本 spec は消費)。
- 指標式本体(EV_abs/EV%/PV/AC/SPI/CPI/被覆) → `moira-evm`、leveler/予測/buffer 導出 → `moira-schedule`。
- 警告の**提示(レイアウト・畳み込み・淡色化・並び替え・deep-link)** → surface spec(`moira-surface-decision`/`moira-surface-health` 等)。本 spec は提示の下限(何を surface すべきか・会計に残すこと)のみ確定。
- 警告解消の**書き(commit)** → write skill(reschedule/cancel-scope/estimate-agree 等)。検出=読 / 解消=書 の分離(roadmap)。
- c 宣言・期日/目標日 の**入力編集** → write skill / config 面。

## Boundary Candidates（health が所有を主張する seam）
- `moira/frontend/src/moira/warnings.ts`(`computeInbox`) — 警告確定・集約・clearance 記述・行為列挙の単一定義(現状は判断型 4 件+commit 2 件; 本 spec で 9 警告へ拡張・検出データは下流から受ける)。
- 行為列挙の単一定義モジュール(各警告の `actions`/`clearWhen`)——導出層に一度だけ置く新設境界。
- 9 警告の集約口(判断型 8 件の inbox 集約 + R-S6 の health 常駐修飾の区別)。

## Out of Boundary（health が触らない）
- 各 derivation の検出述語本体(`derivations/*` の overload/deadline/orphan/thrashing/coverage 判定ロジック)。
- `moira-core` の fold/derive/effective-set/latest-wins/状態機械 の定義。
- surface コンポーネント(`DecisionInboxSurface.tsx`/`HealthSurface.tsx` の UI)・提示の自由(③)。
- write skill のイベント発行・人間承認ステップ。

## Upstream（health が依存する）
- `moira-evm` — R-S3 thrashing の検出データ(EV_abs 非増 ∧ AC sustained 増)。
- `moira-schedule` — R-T3 過負荷・R-T4 期日超過(導出完了 vs 期日)・R-S6 スケジュールカバレッジ低・R-S7 スロット陳腐化(原因別) の検出データ。
- `moira-scope-deps` — R-C3 キャンセル孤児の依存辺評価。
- `moira-core`(間接基盤) — derive/二層データ/effective-set/latest-wins/状態機械(R-U12/R-U13/P5 の基礎状態)。
- 一次資料: `moira/MODEL.md`(v16, 凍結・SSOT)・`moira/UI-ARCHITECTURE.md` §4.2/§6。

## Downstream（health の集約・行為列挙を消費する）
- `moira-surface-decision`(薄: warning 読+deep-link+詳細+次 action+判断基準。導出層の行為列挙を読む)。
- `moira-surface-health`(R-S6 de-rate 等の常駐メトリクス修飾を表示)。
- `moira-evm-digest`(skill。as-of 導出差分。行為列挙は導出層を読む)。
- 共有シーム(roadmap): 行為列挙の単一定義(health に一度だけ定義し surface-decision・evm-digest が読む; UI-ARCH §6)、warning 述語(検出データは各 derivation、確定/集約は health)。

## Existing Spec Touchpoints
- 上流 read spec: `moira-evm` / `moira-schedule` / `moira-scope-deps`(Wave1)・`moira-core`(Wave0)。本 spec はそれらの検出データ/契約を消費する。
- 参照実装(`moira/frontend/src/moira/warnings.ts`)は spec ではなくフォワード本番プロト。design はこの seam に整合させ、出力は MODEL 準拠とする。

## Constraints
- `moira/MODEL.md` v16 を **SSOT として凍結遵守**。MODEL の文言を勝手に変えない・新概念を足さない。モデル変更は `moira-model-update` ゲート経由のみ。
- **検出=読 / 解消=書 の分離**(roadmap): 本 spec は警告の検出・確定・集約・行為列挙(読)に徹し、解消(書)は write skill。R-S3/R-S6 等 de-rate・検出系は読 spec のみ。
- **検出ロジック自体は各導出 spec が所有**。本 spec は検出データを集約・確定する(roadmap Boundary Strategy)。
- **警告は acknowledge で消えない**(§2.1): 現在状態の述語として条件が真の間だけ可視ギャップに残り、条件を偽化する入力(4 イベント追記 または 構成入力 c/期日/目標日 変更)でのみ消える。acknowledge/dismiss/seen 可変状態を持たない(最小性)。
- **提示は会計から警告を除かない**(P0 falsifiable な線): 顕著さ制御(畳む/淡色化/並び替え)は可だが、可視ギャップのカウント/リストから落とすのは P0 違反。
- **R-S6 は de-rate 型 = inbox 非集約**(8 集約 + R-S6 常駐 = 計 9 件すべてに host; UI-ARCH §4.2/§3)。
- **行為列挙は導出層に一本化**(UI-ARCH §6): 各警告の取りうる行為を導出層で一度だけ定義し、inbox と文脈ビューで二重実装しない。
- **自前の真実源・可変状態を持たない**: `moira-core` の derive(R-S2 同一ログ・同一実装で再現)を消費し、層間に隠れたキャッシュを置かない。
- EARS は ja・`requirements-style.md` 準拠(英文＋和訳併記)。トレースは `trace-notation.md`、命名は `moira-naming.md`、配置は `structure.md`/`tech.md`。
