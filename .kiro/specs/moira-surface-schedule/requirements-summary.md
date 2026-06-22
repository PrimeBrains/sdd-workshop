# moira-surface-schedule 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-surface-schedule` は、Moira 正典モデル `moira/MODEL.md`(SSOT) を本番アーキテクチャへ落とす **CQRS 分解の Wave3 read サーフェス**であり、`moira/UI-ARCHITECTURE.md` が R-S2 に予約する三ダッシュボードの一つ `schedule-time`（スケジュール・時間）を担う。**全 actor 共通の母 view** であり、read-only（自前状態なし・derive() を読むだけ）。

本 surface は上流 `moira-schedule`（導出）および推移的に `moira-core`（emit/derive 契約）の導出出力を**消費**する。MODEL を唯一の真実源とし、その提示の下限を写すことに徹する。**検出=読 / 解消=書 の分離**に従い、陳腐化・de-rate・過負荷・未割当ギャップは検出（読）のみを所有し、再ベースライン・再割当・c 改定は write skill へ委譲する。なお一部の read データ（R-S7 原因別カウント・人別 c 充当・R-T4 超過量・P5 解放済み後続・R-C3 孤児）は上流 derive 契約の新設を前提とし、その契約拡張は design 送り。

## 主要な要件の要点

- **read-only 母 view と二系統計算の禁止（要件1）**：`schedule-time` は上流の導出状態に対する read-only view であり、真実源も隠れた可変キャッシュも自前の dismiss フラグも持たない。集約 derive() 所有指標（SPI/CPI・EV%/EV_abs・各カバレッジ・予測）の再計算は禁止。ただし per-node 属性射影（per-task PV/EV、提示恒等式 SV=EV−PV / CV=EV−AC）は属性の表示用写像として許容される（裁定済み）。
- **Gantt + DAG ビューア（要件2）**：木×DAG 射影の上に Gantt と DAG ビューア（再利用部品）を表示し、各サブ単位ごとに生きた予測完了（P7）と凍結ベースライン完了スロット（`frozenSlot`）を区別して両表示する。PV(t)/PMB 予算総和は health が host する量であり本 surface では描画しない。エージェント作業は人間作業と視覚的に区別し、エージェント行に過負荷マーカーを描かない。各ノードの lifecycle 状態は Gantt 行上の副 host として表示する（主 host は spec-value）。
- **担当の常時表示（要件3）**：各ノードの単一被割当者を行の常時表示プロパティとして示す（識別情報のみ）。スキルや習熟度は表示しない。上流が `(ts,id)` latest-wins で更新した現行の単一被割当者を表示し、複数蓄積しない。
- **未割当バックログの可視ギャップ表示と未割当フィルタ（要件4）**：被割当者のいない合意済みノードを Gantt 内の時間軸を持たない lane に可視ギャップとして赤で表示し、未割当フィルタで絞り込む。未コミット領域をスケジュール済みと暗黙に仮定しない。本要件の未割当バックログと要件9が指す未スケジュールの合意作業は同一の P0/R-U9 可視ギャップ集合であり、二重計上しない。
- **担当付替プルダウン（要件5）**：ノード上に割当/リスケの write skill へ deep-link する付替プルダウンを提供する。本 surface では書き込みを行わず、検出（割当/未割当状態の読み出し）のみ所有し、解消（割当の書き込み）は write skill へルーティングする。
- **スロット陳腐化の原因別可視ギャップ（要件6）**：生きた予測完了が凍結ベースライン slot と乖離したサブ単位を、原因別（割当変更 / c(i,d) 変更）に陳腐化の可能性ありとして標識し、スケジュールカバレッジと並ぶ可視ギャップとして提示する。「確認」（ベースラインの意図的維持）は陳腐化標識を消さない。顕著さを抑制しても可視ギャップの会計から除かない。
- **人別日次充当健全性と過負荷（要件7）**：人ごとの日次容量 c(i,d) 充当を、期間内の平準化負荷が見えるように表示する。割当が c(i,d) 平準化に収まらない場合（c=0 日の AC 計上を含む）、過負荷を当該人物と期間を特定する read シグナルとして提示し、再割当へ deep-link する。過負荷シグナルは人間資源に対してのみ発し、エージェント資源には発しない。
- **actor 種別フィルタ（要件8）**：actor 種別フィルタ（全員 / 人間 / エージェント）で同一 DAG×ログクエリを actor フィルタ違いで読み、三キュー（作業/レビュー/エージェント）を被覆する。`human` は人間レビューと人間作業を束ねる。本フィルタが切るのは actor の種別であって作業/レビューの分割ではない。人間の役割（管理者/開発者）は同一導出に対するフィルタまたは初期プリセットであり、物理分割しない。絞り込みは葉ノードに作用し、構造足場（親/非葉ノード）はフィルタに依らず保持する。
- **SPI＋スケジュールカバレッジ de-rate strip の副 host（要件9）**：R-S6 の副 host として、SPI とスケジュールカバレッジを対で示す strip を描画し、低カバレッジ時はカバレッジバーを淡色化＋注記で SPI を全体進捗と読ませない。SPI 値は素値表示で health と同一導出の read。主 host・集約スケジュールカバレッジの host は `moira-surface-health` であり、本 surface は副 host strip と deep-link のみを所有する（裁定済み）。同一未割当ギャップ（要件4）を R-S6 警告の write 文脈として位置づけ、割当付与 write へ deep-link する。
- **期日超過アラートの read 表示と deep-link（要件10）**：導出スケジュールが外部期日を超える間、超過量（導出完了 − 期日）を伴うアラートを read で表示する。要員追加やスコープ削除は自動化しない。スコープ/期日判断（health）と実行への deep-link のみを所有し、横断集約（主 host = inbox）と判断（host = health）は所有しない。超過を受容して行動しないことはアラートを消さない。
- **P5 at-risk（解放済み後続）の副 host read（要件11）**：起点ノードの後退で at-risk となった解放済み後続を、スケジュール文脈（Gantt）の副 host として read 表示し、起点ノードの再到達 write へ deep-link する。起点ノードの主 host は `moira-surface-spec-value`、主集約は inbox。本 surface は解放済み後続の副 host 表示とルーティングのみを所有し、P5 述語の再計算は行わない。後続自身の完了は at-risk シグナルを消さない。
- **R-C3 キャンセル孤児の文脈ビュー read（要件12）**：cancel により永久に充足不能となった依存（孤児）を、スケジュール文脈の文脈ビュー read シグナルとして表示し、辺除去/付替/後続 cancel の write へ deep-link する。孤児の検出（述語評価）は上流 `moira-scope-deps` が所有し、本 surface は読むだけ。主集約は inbox、文脈ビューは spec-value と schedule-time の双方。

## スコープ

**やること（本 surface が所有 — read 提示と deep-link）**
- read-only 母 view 規律（自前状態なし・二系統計算の禁止。per-node 属性射影は許容）。
- Gantt + DAG ビューア（再利用部品）：生きた予測完了と凍結ベースライン slot の両表示・ノード状態副 host。
- 担当の常時表示（単一被割当者の識別情報のみ。スキル/習熟度は出さない）。
- 未割当バックログの Gantt 内赤表示（時間軸なし lane の可視ギャップ）＋未割当フィルタ。
- 担当付替プルダウン（write skill への deep-link。書き込みは所有しない）。
- R-S7 スロット陳腐化の原因別（割当変更 / c 変更）可視ギャップ提示。
- 人別日次 c(i,d) 充当健全性（R-T3 過負荷の read 可視化。人間資源のみ）。
- actor 種別フィルタ（全員/人間/エージェント。同一クエリの actor フィルタ違いで三キューを被覆）。
- SPI＋スケジュールカバレッジ de-rate strip（R-S6 副 host。主 host・集約値は health）。
- R-T4 期日超過の read 表示と判断・実行への deep-link。
- P5 解放済み後続の副 host read 表示と起点再到達 deep-link。
- R-C3 キャンセル孤児の文脈ビュー read 表示と解消 write deep-link。

**やらないこと（上流/他 spec が所有）**
- スケジュール導出ロジック本体（leveler P7/P8・予測・slot 充填・スケジュール被覆・D_pred・バッファ R-T6 導出）= `moira-schedule`。
- emit/derive 契約・effective-set・latest-wins・二層データ・凍結ベースラインの記録機構 = `moira-core`。
- 担当・c・再ベースライン・スコープ/期日の**書き込み** = `moira-assign-schedule` / `moira-reschedule` / `moira-capacity` / `moira-rebaseline` / `moira-project-config`。
- 9 warning の確定・集約・clearance・行為列挙の単一定義 = `moira-health`。
- SPI de-rate の**主 host**・集約スケジュールカバレッジの host = `moira-surface-health`。
- EV%・見積カバレッジ・実行カバレッジ・現行有効集合の EV% = `moira-surface-spec-value`。
- decision インボックスの横断集約・ルーティング = 別面。
- 孤児の検出（依存述語の永久充足不能評価）= `moira-scope-deps`。
