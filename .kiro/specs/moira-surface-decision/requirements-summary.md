# moira-surface-decision 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-surface-decision` は、Moira 正典モデルを本番アーキテクチャへ落とす **CQRS 分解の Wave3（surface 群）**であり、「システムは観測・導出・警告に徹し、コミットメントを伴う判断は人間に残す」という中核思想のうち、**横断的に散らばる警告と人間のコミット判断を一望し、各々を解消する文脈ビュー（write）へ動線を引く**「横断・行為（decision）」面を所有する read 導出サーフェス spec である。

本 spec は MODEL を唯一の真実源(SSOT)とし、MODEL の文言を変えず・新概念を足さず、その実装への落とし込み（集約提示・deep-link ルーティング・新規/据え置き区別・可視ギャップ会計の保持）に徹する。警告の検出・確定・集約・clearance・行為列挙の単一定義は上流 `moira-health` が所有し、本 spec はそれらと `moira-core` の derive 契約を**消費**する。自前の真実源・可変状態を持たない read-only のルーティング面である。

## 主要な要件の要点

- **判断・行為を要する警告の集約一望（要件1）**：上流 `moira-health` が確定・集約した判断型 8 警告（R-U12/R-U13/R-T3/R-T4/R-S3/R-S7/R-C3 および P5 at-risk）を、decision インボックスへ集約して一望する。再検出・再確定はせず、health の集約を読むだけ。de-rate 型の R-S6 は集約せず health の常駐メトリクス修飾に委ねる。R-S4 は警告ではなく区別表示規則であり本 surface の責務外。インボックスは `moira-health` と `moira-core` の derive 出力を消費し、自前の真実源も隠れた可変キャッシュも持たず、3 ダッシュボードと同一のクエリ（P4）を参照する。
- **コミット判断の集約（要件2）**：5 コミット判断のうち 4 つを集約対象とし、二重計上を回避してレーン分けする。見積の合意（現行有効葉のうち `proposed` の集合）と割当（合意済み未割当 backlog）をそれぞれ独立した commit 行として集約する。スコープ/期日は R-T4 警告行（要件1）へ一本化し別個の commit 行にはしない。見積の深さ（R-E2b）は導出層が判断待ち集合を供給する場合に限り条件付きで集約する。第 5 の c 宣言は capacity config 面の責務ゆえ除外する。判断待ちキューは同一 DAG×ログへの actor フィルタ違い（P4）として導出し、役割で物理分割しない。コミット判断は人間に属するものとして提示し自動解決しない。
- **文脈ビューへの deep-link ルーティングと共有部品・per-node 射影（要件3）**：各警告/判断の行から、それを解消する文脈ビュー（write）への deep-link を提供する。deep-link は同一クエリへの参照であり再計算ではない。横断判断（例: R-T4）は複数 deep-link を許す。本 surface 自身は警告を解消する write を行わない（検出=読/解消=書 の分離）。提示には共有テーマ部品（Card/Pill/SectionTitle・EVM トークン等）を再利用し、surface 独自の再実装で他サーフェスと乖離させない。per-task の EVM 詳細を補助提示する場合は per-node 属性からの read-only な射影のみ許容し、集約 derive 所有指標の再計算は禁止する。
- **詳細・次の行為・判断基準は導出層の単一定義を読むだけ（要件4）**：各警告の詳細・次の行為・判断基準（取りうる行為列挙）は、`moira-health` に一度だけ定義された単一定義を読み取って表示し、再定義・再実装しない。clearance 条件（警告を偽化する条件）も導出層を出所とする読み出し専用データとして表示する。R-S7（陳腐化スロット）は導出層が供給する原因別属性（割当変更 vs. c 起因）を保って提示し、原因を捨象した単一カウントへ畳まない。deep-link 先も原因別に分岐する（割当変更→schedule-time、c 起因→加えて capacity config 面）。
- **acknowledge を持たず、可視ギャップ会計から警告を除かない（要件5）**：acknowledge・dismiss・snooze・既読の可変状態を一切保持しない。条件が真である間は警告を残し、イベントまたは構成入力の変更が条件を偽化したときのみ除去する。提示が淡色化・畳み込み・並び替えしていても、依然真であるすべての警告を可視ギャップの会計（件数・リスト）に残す。件数サマリは「全N件・うち据え置きM件」とし、新規/据え置きの区別は seen 状態に依らず導出層の truth-onset（警告条件の真化年齢）で判定する。truth-onset が供給されない場合は「全N件」のみとし、M を seen 状態から捏造しない。N=0 のときも「全0件」を表示する。
- **capacity heatmap は host せず deep-link でルーティング（要件6）**：c(i,d) heatmap を decision 面で host も描画もしない（host は capacity config 面）。c の write・改定も行わない。c 起因の判断（R-T3 過負荷、R-S7 の c 起因分）は capacity config 面への deep-link でルーティングする。

## スコープ

**やること（surface-decision が所有）**
- 判断型 8 警告の集約一望（health 確定結果の read 提示）。
- 5 コミット判断のうち 4 つの判断待ち集約（同一クエリの actor フィルタ＝P4）。レーン配置: commit 行 2（見積合意・割当）＋警告行 1（スコープ/期日→R-T4）＋条件付き 1（見積の深さ）。
- 各行から文脈ビュー write への deep-link ルーティング（複数 deep-link 可・参照のみ）。
- 各警告の詳細・次の行為・判断基準（行為列挙の単一定義 by health）を読むだけで表示。
- 「新規」と「据え置き・既知」の区別表示（seen 状態に依らず truth-onset で判定）と可視ギャップ会計の保持（P0・件数サマリ・N=0 を含む）。
- c 起因判断の capacity config 面への deep-link ルーティング。
- 自前状態（dismiss/seen/snooze）の不在と条件偽化での自動消滅。
- 共有テーマ部品の再利用と per-node 属性射影の許容（集約 derive 所有指標の再計算は禁止）。

**やらないこと（上流/下流が所有）**
- 9 警告の検出述語/ロジック本体・確定・集約・clearance の単一定義・行為列挙の単一定義・判断型/de-rate 型の区別 = `moira-health`（本 spec は読む側）。
- de-rate 型 R-S6 の表出（常駐メトリクス修飾）= health。R-S4 の表出 = spec-value。
- 全 write（見積合意・再見積・割当・スコープ/期日変更・再ベースライン・cancel・config）= moira-* write skill 群。
- c 宣言の write・c(i,d) 入力・理由付き改定・capacity heatmap の host/READ 表示 = capacity config 面。
- emit/derive・二層データ・R-S2 導出オーケストレータ・三キュー（P4）の導出 = `moira-core`。
- 他軸の常駐ダッシュボード（spec-value/schedule-time/health）の提示 = 各 surface spec。
