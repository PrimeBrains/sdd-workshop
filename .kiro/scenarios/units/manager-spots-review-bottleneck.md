---
id: units/manager-spots-review-bottleneck
title: 管理者が「AIは動いているのに進まない」を見抜く——AI稼働の表示が活発でも、人間の対応待ち（合意待ち＋承認待ち）の件数と「最も古い待ち時間」でボトルネックが人間側だと一目で分かる（現状は承認待ちの件数しか出ず、待ち時間も合意待ちも映らないため見落とす）
status: draft
language: ja
actor: 管理者
surfaces: [health, schedule-time, 人間対応待ち(ボトルネック)パネル(新規)]
precondition: プロジェクト進行中。既知の有効葉24のうち、見積が「合意済み」の葉が20・「提案のまま（人間の合意待ち）」の葉が4。AI（Claude）が5葉を実装中・2葉が着手可（agentWorkQueue 7葉）。6葉が「作成完了・レビュー待ち（implemented）」で人間の承認待ち（最も古いものは6日待ち）。4葉が「提案のまま」で人間の見積合意待ち（最も古いものは4日待ち）。人間は太郎ひとりがレビューと合意の担い手＝事実上の制約（ボトルネック）。
postcondition: 管理者が health（管理者プリセット）を開くと、AI稼働の表示（実行カバレッジ25%・実装中5葉・エージェント作業キュー7葉）は活発に見える一方、「人間対応待ち」＝合意待ち4葉（最古4日）＋承認待ち6葉（最古6日）＝計10葉・最古6日 が一目で読め、ボトルネックが AI の処理量でなく人間の対応側にあると把握できる。※この「人間対応待ち（合意待ちを合算し、待ち時間=リードタイムを併記する）」は **既存正典で表現可能な spec/surface の新規 read**（敵対ゲート 2026-06-27 判定＝MODEL 変更不要）。承認待ち＝既存 `humanReviewQueue`（implemented）、合意待ち＝既存 P2 カバレッジの `proposed` 集合、待ち時間＝P6＋既存 `asOf`。実装は moira-schedule／moira-surface-health／UI-ARCH 層。スコープは2ゲート（合意・承認）限定＝完全なボトルネック信号ではない（未割当バックログ R-U9・警告 P5/R-S7 は別途既出）。
touches_specs:
  - moira-core
  - moira-evm
  - moira-schedule
  - moira-surface-schedule
  - moira-surface-health
touches_requirements:
  - "moira-core: 3.1, 3.4, 5.1, 5.3, 6.1, 6.2"
  - "moira-evm: 3.1, 3.2, 5.1, 5.4, 6.1, 6.2"
  - "moira-schedule: 2.1, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3"
  - "moira-surface-schedule: 8.1, 13.1, 13.2, 13.3, 14.1"
  - "moira-surface-health: 4.1, 10.6"
---

# 管理者が「AIは動いているのに進まない」を見抜く——AI稼働の表示が活発でも、人間の対応待ち（合意待ち＋承認待ち）の件数と「最も古い待ち時間」でボトルネックが人間側だと一目で分かる

> 読み方：管理者は §1〜§4 を見れば「この指標があると何が把握しやすくなるか」を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：本ユニットは **人間対応待ち（＝合意待ち合算＋待ち時間）** の価値を示す **draft**。敵対ゲート（2026-06-27・moira-model-update 経由）は本指標が **既存正典で表現可能で MODEL 変更不要** と判定したため、これは **spec/surface 層の新規 read（既存導出の合成）** として接地する。確定（agreed）は spec 化（moira-schedule／moira-surface-health）後の本ユニット再ゲートを前提とする（§7）。

## 1. このユニットで確かめること

AI がどんどん実装を進める時代に、進捗が詰まる場所は「AI の処理量」ではなく「人間が判断（合意・承認）する関門」へ移る。だが現在の画面は **AI がどれだけ稼働しているか（実行カバレッジ・エージェント作業キュー）** をよく見せる一方、**人間の関門でどれだけ滞っているか** は弱くしか見えない——承認待ちは「件数」だけで「何日待っているか」が出ず、見積の合意待ちに至っては待ち行列にすら現れない（カバレッジの%に紛れる）。

このユニットは、**管理者が一目でボトルネックを人間側だと把握できるための指標（既存導出を合成する spec/surface の新規 read）**を確かめる：

- **「AI稼働」は活発に見えても、それ単体ではボトルネックを示さない。** AI が5葉を実装中（実行カバレッジ25%・エージェント作業キュー7葉）でも、それは「人間の関門が空いているか」を何も語らない。
- **人間対応待ち（spec/surface 新規 read）** を、**合意待ち（提案のまま）と承認待ち（作成完了・レビュー待ち）の両方を合算した件数**で出す。今は承認待ち（implemented）しか待ち行列に出ず、合意待ち（提案のまま）はカバレッジ%に埋もれて見落とされる。
- さらに **「最も古い待ち時間」（リードタイム＝待ち始めてからの経過。P6）** を併記する。件数だけでは「6件、そのうち捌ける」に見えるが、「最古6日」が付くと滞留が露わになる。
- 結果、管理者は **「ボトルネックは AI の処理量でなく、人間の対応（合意・承認）側にある」** と一目で分かる——AI を増やしても関門は空かない、という判断につながる。
- **正直なスコープ（重要）**：本指標は **パイプライン2ゲート（合意待ち＋承認待ち）の滞留**であって、**完全なボトルネック信号ではない**。未割当バックログ（割当待ち・R-U9）・at-risk（P5）・陳腐化（R-S7）も「人間待ち」だが、それらは別の既出信号（可視ギャップ／警告）として現れる。本ユニットは過剰主張を避け、2ゲートに限定して「AI が動いていても人間の関門で詰まる」を示す。

> **対比の核心（§4 で Before→After として描く）:** *Before*＝現状（AI稼働は活発・承認待ちは件数のみ・合意待ちは不可視）ではボトルネックが埋もれる。*After*＝提案メトリクス（人間対応待ち＝合意+承認の合算件数＋最古待ち時間）でボトルネックが顕在化する。

## 2. 前提（Given）

プロジェクト進行中。既知の有効葉24。人間は太郎ひとりがレビュー・合意を担う。AI は Claude。

| 区分（葉の状態） | 件数 | 補足 | 待ち時間（最古） |
|---|---|---:|---|
| 見積「提案のまま」（人間の**合意待ち**） | 4 | 太郎の見積合意を待っている。現行はどの待ち行列にも出ず、見積カバレッジの不足分（=未合意）に埋もれる | **4日** |
| 「作成完了・レビュー待ち（implemented）」（人間の**承認待ち**） | 6 | 太郎の承認（`implemented→accepted`）待ち。現行は承認待ちキューに**件数のみ**出る | **6日** |
| 「実装中（implementing）」（AI が作業中） | 5 | Claude が実装中。エージェント作業キューに出る＝「AI稼働」 | — |
| 「着手可（ready）」（AI 割当済・未着手） | 2 | エージェント作業キューに出る | — |
| 「承認済み（accepted）」（完了） | 3 | 出来高は獲得済み | — |
| 見積合意済みだが未着手（pending） | 4 | — | — |
| **合計（既知の有効葉）** | **24** | うち見積合意済み 20・提案のまま 4 | — |

- 見積カバレッジ：**83%**（合意済み有効葉 20 / 既知 24）← 合意待ち4葉はこの「17%の不足」に埋もれる
- 実行カバレッジ：**25%**（実装中の合意済み葉 5 / 合意済み 20）← 「AI稼働」の代理
- エージェント作業キュー：**7葉**（実装中5＋着手可2、いずれも Claude 割当）← 「AI稼働」
- 承認待ちキュー（現行・件数のみ）：**6葉**（implemented）
- 合意待ち（現行は待ち行列に出ない）：**4葉**（提案のまま）
- 出来高 EV%：例示で **約30%**（完了9葉〔implemented 6＋accepted 3〕の凍結予算 ÷ 合意済み葉の見積合計。本ユニットの焦点ではないため概数）

## 3. ふるまい（When / Then）

```
When  管理者がプロジェクトの状況を画面で見る。いま AI（エージェント）は複数の作業を
      実装中で「AI はよく稼働している」ように見える。その一方で、いくつもの作業が
      人間の対応を待って止まっている——一部は見積りへの合意待ち、一部は出来上がった
      成果物のレビュー（承認）待ちで、中には何日も待っているものがある。
Then  「AI がどれだけ稼働しているか」の表示は活発に見え、それ単体ではこの停滞を示さない。
And   それとは別に、システムは「いま人間の対応を待っている作業がどれだけあるか」を、
      見積りの合意待ちと成果物の承認待ちの両方を合わせた件数で示す。
And   さらに、その待ち作業が「いちばん古いもので何日待たされているか」を併せて示す。
And   待ち件数が多く・最も古い待ちが何日にもなっているため、管理者は一目で
      「ボトルネックは AI の処理量ではなく、人間の対応（合意・承認）の側にある」と分かる。
```

<small>注（平易語と内部対応・本文には出さない最小注釈）：「AIがどれだけ稼働しているか」＝実行カバレッジ（実装中の葉の割合）＋エージェント作業キュー。「成果物の承認待ち」＝作成完了（implemented）でレビュー待ちの葉（現行の承認待ちキュー）。「見積りの合意待ち」＝見積が提案のままで人間の合意を待つ葉（**現行は待ち行列に出ない＝新規**）。「いちばん古い待ち時間」＝待ち始めた遷移の時刻からの経過（リードタイム・P6。**待ち行列への併記は新規**）。「人間の対応を待っている作業の合算件数＋待ち時間」は **既存導出の合成（spec/surface の新規 read）**＝承認待ち（既存 `humanReviewQueue`）＋合意待ち（既存 P2 の `proposed` 集合）＋待ち時間（P6＋既存 `asOf`）。MODEL 変更は不要（§7）。</small>

## 4. 画面の変化（Before → After）

採用表現は **health（管理者プリセット）**。同じ瞬間のプロジェクト状態を、**Before＝現行の見え方**（AI稼働は活発・承認待ちは件数のみ・合意待ちは不可視）と、**After＝提案メトリクス**（人間対応待ち＝合意+承認の合算件数＋最古待ち時間）で対比する。**状態（イベントログ）は同一**で、変わるのは「何をどう見せるか」だけ。

### 4-1. データ表（素の値・HTML が剥がれても読める）

| 指標 | Before（現行の見せ方） | After（新規 read・spec/surface） |
|---|---|---|
| AI稼働（実行カバレッジ） | **25%**（実装中5/20） | 25%（同じ。ただし「進捗」でなく「AI仕掛中量」と位置づけ） |
| エージェント作業キュー | **7葉**（活発に見える） | 7葉（同じ） |
| 出来高 EV% | 約30% | 約30%（同じ） |
| 承認待ち | **6葉（件数のみ）** | 6葉（最古 **6日**） |
| 合意待ち | （待ち行列に出ない・カバレッジ83%に埋もれる） | **4葉（最古 4日）** |
| **人間対応待ち（合算）** | **— 指標として存在しない —** | **10葉・最古 6日**（合意4＋承認6） |

> Before では「AI稼働25%・キュー7葉」が目立ち、「承認待ち6件」も「いずれ捌ける量」に見え、合意待ち4件は数字としてどこにも立たない。After では「人間対応待ち 10葉・最古6日」という一行が、ボトルネックの所在と深刻さ（6日滞留）を一目で示す。

### 4-2. health 画面モックアップ（管理者プリセット）

<div style="font-family:system-ui,sans-serif;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;max-width:720px">
  <div style="background:#7f1d1d;color:#fff;padding:6px 10px">🩺 health（管理者プリセット）— <b>Before（現行の見せ方）</b></div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#fff">
    <div style="flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:8px">
      <div style="color:#64748b;font-size:11px">AI稼働（実行カバレッジ）</div>
      <div style="font-size:22px;font-weight:700;color:#1d4ed8">25%</div>
      <div style="font-size:11px;color:#1d4ed8">実装中 5 葉・<b>エージェント作業キュー 7</b> 🤖 活発</div>
    </div>
    <div style="flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:8px">
      <div style="color:#64748b;font-size:11px">出来高 EV%</div>
      <div style="font-size:22px;font-weight:700">~30%</div>
      <div style="font-size:11px;color:#64748b">見積カバレッジ 83%</div>
    </div>
    <div style="flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:8px">
      <div style="color:#64748b;font-size:11px">承認待ち（レビュー待ちキュー）</div>
      <div style="font-size:22px;font-weight:700;color:#b45309">6 件</div>
      <div style="font-size:11px;color:#94a3b8">※ 待ち時間の表示なし／合意待ちは出ない</div>
    </div>
  </div>
  <div style="padding:6px 10px;background:#fef2f2;color:#7f1d1d;font-size:12px">😟 見え方：「AI は7件動いている・承認待ちは6件。回っていそう」——<b>合意待ち4件と『最古6日』の滞留が埋もれ、ボトルネックが見えない</b></div>
</div>

<div style="font-family:system-ui,sans-serif;font-size:13px;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;max-width:720px;margin-top:12px">
  <div style="background:#14532d;color:#fff;padding:6px 10px">🩺 health（管理者プリセット）— <b>After（新規 read・spec/surface）</b></div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#fff">
    <div style="flex:1;min-width:150px;border:1px solid #e2e8f0;border-radius:6px;padding:8px;opacity:.7">
      <div style="color:#64748b;font-size:11px">AI稼働（仕掛中量・参考）</div>
      <div style="font-size:20px;font-weight:700;color:#1d4ed8">25%</div>
      <div style="font-size:11px;color:#64748b">実装中 5・キュー 7（＝処理能力側。制約ではない）</div>
    </div>
    <div style="flex:2;min-width:240px;border:2px solid #16a34a;border-radius:6px;padding:8px;background:#f0fdf4">
      <div style="color:#14532d;font-size:11px;font-weight:700">🚦 人間対応待ち（ボトルネック）<span style="color:#16a34a">（新規）</span></div>
      <div style="font-size:26px;font-weight:800;color:#14532d">10 葉・最古 <span style="color:#b91c1c">6日</span></div>
      <div style="font-size:12px;color:#166534;margin-top:2px">└ 合意待ち <b>4</b>（最古4日）　└ 承認待ち <b>6</b>（最古6日）</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">担い手：👤 太郎（単一）← ここが制約</div>
    </div>
  </div>
  <div style="padding:6px 10px;background:#f0fdf4;color:#14532d;font-size:12px">🎯 見え方：「AI は能力に余裕（仕掛7）。だが<b>人間の関門に10件・6日滞留</b>。ボトルネックは人間側」——AI増強でなくレビュー/合意の手当てへ</div>
</div>

<small>※ **役割は物理分割でなく同一導出への絞り込みプリセット**（surface-health 10.6・初期プリセット管理者）。Before/After は**別データではなく同一状態の見せ方の差**で、新規パネルも `moira-core` の単一導出（R-S2）から読む read であって再計算しない（UI-ARCH §6 二系統計算の禁止）。「AI稼働」を After で淡色化＝「処理能力側であって制約ではない」という位置づけ（数値は不変）。</small>

### 4-3. （参考）schedule-time 上の現行「レビュー待ち一覧」

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;max-width:720px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 schedule-time：人間レビュー待ちキュー（現行・surface-schedule Req13）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業（implemented 葉）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">待ち時間（提案・新規併記）</td>
  </tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">作業A（レビュー待ち）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#b91c1c"><b>6日</b></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">作業B〜F（レビュー待ち・計5）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎</td><td style="padding:6px 10px;border:1px solid #cbd5e1">1〜4日</td></tr>
</table>

<small>※ 現行の本一覧は **承認待ち（implemented）件数の read**（surface-schedule Req13・moira-schedule Req4 AC3＝`humanReviewQueue` は actor 非依存導出）。**待ち時間の併記と「合意待ち（提案のまま）」の合算は本ユニットの新規 read**で、現行の `humanReviewQueue` 導出（件数のみ）には未含だが、既存部品（P2 の `proposed` 集合＋P6＋`asOf`）の合成で表現でき MODEL 変更は要らない（§7）。</small>

## 5. 出力されるログ（どこに・何が）

**重要：このユニットは新しいイベント種別を一切足さない。** 待ち時間も合意待ちも、既存の追記済みイベントの**時刻と状態から導出**できる（P6：滞留時間＝ts 差／moira-schedule Req13：状態遷移の時刻から per-node の予定/実績を導出）。

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | 既存の追記済みイベントのみ。新規イベントなし。承認待ちの待ち時間＝「`implemented` への `transition` の ts」からの経過。合意待ちの待ち時間＝「当該葉の見積提案（`decompose`）の ts」からの経過。いずれも読み出し時点（now）を基準に算出。**now ＝既存の `asOf` 導出入力**（`derive.ts`／PV(t) が既使用）で供給済み——新たな仕組みは不要 |
| **会話ログ**（`.kiro/conversations/{日付}-manager-spots-review-bottleneck.md`） | 管理者がボトルネックを人間側と判断した根拠、提案メトリクスの定義（合意+承認の合算・待ち時間併記）、AI増強でなくレビュー/合意手当てへ向かう判断 |
| **人間が見る画面** | health（管理者プリセット）に「人間対応待ち（ボトルネック）」パネル（**新規**）。schedule-time のレビュー待ち一覧に待ち時間併記（**新規**）。AI稼働（実行カバレッジ・キュー）は現行どおり（位置づけのみ「処理能力側」へ） |

```json
[
  {
    "id": "e210", "ts": 1000,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "decompose",
    "node": "F/leafP1",
    "estimate": 3,
    "reason": "見積を提案（proposed）。人間の合意待ちに入る（合意待ち時間の起点 ts）"
  },
  {
    "id": "e244", "ts": 4460,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/leafA",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "AI が作成完了・人間の承認待ちへ（承認待ち時間の起点 ts）"
  }
]
```

<small>注：ノード ID・ts 値は例示。**e210** は見積提案（`decompose`・`estimate` を伴う `proposed`）で「合意待ち」の起点。**e244** は `implemented` への `transition` で「承認待ち」の起点。待ち時間＝（読み出し時点 now − 起点 ts）。`decompose`/`transition` はいずれも実在の4イベント（`types.ts`）で、**新イベントは不要**。導出が必要とする「now（読み出し時点）」は **既存の `asOf` 導出入力**（`derive.ts:34`／PV(t) が既使用）で供給され、`age = asOf − 起点ts` は `(ログ, asOf)` で決定的＝追記専用・再現可能を崩さない（PV(asOf) と同型）。MODEL 変更不要（§7）。</small>

## 6. 受け入れ条件（EARS）

> 注：本 §6 は受け入れ条件（draft）。MODEL 変更は不要（既存正典で表現）＝確定は spec 化（moira-schedule／moira-surface-health）後の本ユニット再ゲート後。

- **WHILE** AI が複数の作業を実装中で「AI稼働」の表示が活発な間、**システムは** AI稼働の表示（実行カバレッジ・エージェント作業キュー）だけをもってプロジェクトの停滞有無を表してはならない（AI稼働は処理能力側の量であってボトルネックの所在を語らない）。
- **WHEN** 管理者がプロジェクトの状況を読むとき、**システムは** いま人間の対応を待っている作業の件数を、**見積りの合意待ち（提案のまま）と成果物の承認待ち（作成完了）の両方を合わせて**示さなければならない。
- **WHEN** 人間対応待ちを示すとき、**システムは** その待ち作業のうち**最も古いものの待ち時間**（待ち始めた時点からの経過）を併せて示さなければならない。
- **WHEN** 見積りが提案のまま人間の合意を待っているとき、**システムは** それを人間対応待ちに数え、見積カバレッジの不足分にのみ埋もれさせてはならない。
- **WHEN** 人間対応待ちと待ち時間を導出するとき、**システムは** 新しいイベント種別を追加せず、既存の追記済みイベントの時刻と状態からのみ導出しなければならない（追記専用・再現可能を保つ）。
- **WHERE** 役割が管理者プリセットのとき、**システムは** 人間対応待ち（ボトルネック）を同一の単一導出への絞り込みとして提示し、役割ごとに別系統の値を再計算してはならない。

## 7. 決定事項（draft）

> 敵対ゲート（2026-06-27・moira-model-update 経由・moira-adversary×3＋asOf 一次確認）と、それを受けたユーザー決定。**MODEL 変更は不要**と判定されたため、本ユニットは既存正典の参照で確定を目指す（実装は spec/surface 層）。

- **§3 批准済み（2026-06-27・人間）。** ふるまい（AI稼働の表示だけでは停滞を示さず／人間対応待ち＝合意待ち＋承認待ちの合算件数＋最も古い待ち時間でボトルネックを管理者に示す）と、転記で足した線引き B1〜B4（B1 最古待ち時間の併記／B2 合意待ち＋承認待ちの合算指標化／B3 管理者・health プリセットへの接地／B4 AI稼働を「処理能力側・制約でない」と位置づけ）をユーザーが批准。**§3 は不可侵の人間意図として固定**し、以降のレビュー・パッチで改変しない。
- **MODEL 変更不要（敵対ゲート判定 2026-06-27）。** 本指標は既存正典で表現可能：承認待ち＝既存 `humanReviewQueue`（lifecycle `implemented`・moira-schedule Req4 AC3）／合意待ち＝既存 P2 見積カバレッジの `proposed` 集合／待ち時間＝P6（滞留＝ts差）＋既存 `asOf` 導出入力（`derive.ts:34`・PV(t) が既使用。`age=asOf−起点ts` は `(ログ,asOf)` で決定的）。新要件 R-S9 は冗長（V1 最小性 Critical）として不採用。当初シナリオが (a)(b)(c) を「MODEL 未定義のエスカレーション」とした見立ては**撤回**。
- **実装層（ユーザー決定 2026-06-27）。** MODEL は不変。`moira-schedule`（人間ゲート待ちの read＋age）／`moira-surface-health`（管理者ボトルネックパネル）／`UI-ARCHITECTURE`（execCov を「処理能力側・非ボトルネック」と位置づけ＝役割プリセット/提示の自由）で実装。execCov（R-S8）は式・要件とも不変で残置（早期フェーズの未着手 vs 仕掛中の区別という確立目的）。
- **スコープ（ユーザー決定 2026-06-27）。** 2ゲート（合意待ち＋承認待ち）限定。**完全なボトルネック信号ではない**——未割当バックログ（割当待ち・R-U9）・at-risk（P5）・陳腐化（R-S7）・孤児（R-C3）は別の人間待ち信号として既出。過剰主張を避け、2ゲートに限定して提示する。
- **spec 層で確定すべき設計規則（敵対者指摘・spec 化時に解決）：** (1) **age の起点**＝最新のゲート進入時刻（再見積 R-E3 で `proposed` 復帰・後退遷移 P5 で `implemented` 再到達した場合はその時刻。最初の `decompose` ではない）。(2) **R-U13 重複**（`proposed`∧`implemented`＝未合意完了）は和集合で**1回**数え、age は該当ゲートのうち古い方。(3) **`proposed`∧`accepted`**（未合意のまま承認到達）は承認済みゆえ人間ゲート待ちから**除外**（事後合意の簿記であって停滞でない）。(4) **age ノイズ**：全 `proposed` 計上は一括投入・AI 下書き・故意の据え置きを含むため、execCov の "parked" 同型の de-rate 規律で読む（件数＋最古 age は判断材料であって自動行為の引き金でない）。(5) 中間ノード直接 `proposed`（§7#17）は葉基底で**除外**。
- **(参考・確定済みの接地)** AI稼働の現行挙動（実行カバレッジ＝実装中/合意済み・moira-evm Req5／エージェント作業キュー＝`{ready,implementing}`∧agent・moira-schedule Req4 AC2）、承認待ちキュー（`implemented`・Req4 AC3／surface-schedule Req13）、役割プリセット（surface-health 10.6）は現行どおりに接地しており改変しない。
