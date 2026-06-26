---
id: units/requirements-spec-drafted
title: 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ）」になり、出来高が上がる
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 要件定義・設計・タスクの見積が合意済みで、要件定義の作業はまだ着手前（pending）
postcondition: 要件定義が「作成完了・レビュー待ち（implemented）」になり、玉（次に動く側）が人間に渡って人間レビュー待ちの一覧に現れ、出来高（EV%）が要件定義分だけ上がる。人間の承認はまだ未実施
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 5.1, 5.3, 5.4"
  - "moira-evm: 1.1, 1.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3"
  - "moira-schedule: 4.1, 4.3"
  - "moira-surface-schedule: 2.5, 8.1"
---

# 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ）」になり、出来高が上がる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。

## 1. このユニットで確かめること

見積が合意済みの spec で開発者が要件定義を実際に作る作業（打鍵）を行うと、**要件定義の成果物ができて「レビュー待ち（まだ承認前）」**になり、**そのとき出来高（進捗）が要件定義分だけ上がる**こと（「仕様を書くのも進捗」）。さらに、**いま動くべき側＝人間（レビュー担当）に玉が渡ったことが画面で分かる**こと、**この「レビュー待ち＝玉が人間」は人間のレビュー待ち一覧に現れる（横断の decision インボックスには出ない）**こと、開発者が**自分のレビュー待ちだけに絞り込める**こと（⚠ これは新規要件＝後述）。

## 2. 前提（Given）

新規 spec `F` のフェーズノード（要件定義・設計・タスク）に見積が合意済みで、要件定義の作業はまだ着手前。

| ノード | 見積状態 | 見積値 | lifecycle |
|---|---|---|---|
| F（フィーチャー） | — | — | pending |
| └ 要件定義 | agreed | 3人日 | pending |
| └ 設計 | agreed | 5人日 | pending |
| └ タスク | agreed | 2人日 | pending |

見積カバレッジ（P2・**ノード基底**）：**75%**（独立合意ノード 3 / 既知の有効ノード 4。親 F は I1 ロールアップで独立合意なし＝分母に入り分子に入らない）／実行カバレッジ（葉基底）：**0%**（`implementing` の葉なし）／EV%（出来高）：**0%**（完了葉なし）

## 3. ふるまい（When / Then）

```
When  要件定義・設計・タスクの見積が承認済み（合意済み）になった spec について、
      要件定義を実際に作る作業を打鍵する（要件定義づくりを実行する）。
Then  Claude が要件定義の成果物を作成し、spec-value 画面で要件定義の行が
      「レビュー待ち（提案された・まだ承認前）」になる。
And   出来高（進捗）が要件定義の分だけ上がる
      （※開発者の見立てでは「進捗が進む（50% くらい）」。実際の数値・上がるタイミングは
        §4/§7 で正典に接地）。
And   いま作業のボール（玉）を持っているのは人間（レビュー担当）だと、画面を見て分かる。
And   この「レビュー待ち＝玉が人間」は、人間のレビュー待ち一覧に現れる
      （横断の decision インボックスには出ない）。
And   開発者は自分の名前で、自分がレビュー担当の項目だけに絞り込んで確認できる。
And   人間の承認（OK を出すこと）は、このユニットの対象外（別ユニット）。
```

<small>注：「要件定義を打鍵」の実体は `kiro-spec-requirements`。これが Claude（エージェント）として成果物を作る。lifecycle を進める書き込みの実体は `moira-progress`（仮称・⚠未実装）。「レビュー待ち」は lifecycle の `implemented`（＝作成完了・仕様FIX判定で、人間の承認 `implemented→accepted` 待ち）。「玉が人間」は人間レビュー待ち一覧への出現で表れる。**人間の承認 `implemented→accepted` は別ユニットで、出来高は動かさない品質確認**（§7）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・出来高 EV%）＋ schedule-time（玉＝人間レビュー待ち一覧）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host、ガントは状態＋予測のみ＝前段ユニット `estimate-spec-proposed` §7 と整合）。

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 着手前）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>0%</b>・実行カバレッジ <b>0%</b>・見積カバレッジ(P2) <b>75%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計 / └ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5/2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — 要件定義が作成完了・レビュー待ち）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">30%</b>（0%→30%）・実行カバレッジ <b>0%</b>・見積カバレッジ(P2) <b>75%</b>（不変）<br><span style="color:#b45309">⚑ レビュー待ち 1 件（玉＝人間）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（レビュー待ちとして強調）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 +3人日 算入</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計 / └ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5/2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
  </tr>
</table>

<small>※ <b>出来高 EV% は作成完了（implemented）で 0%→30% に上がる</b>（要件定義の凍結予算 3 ÷ 合意総和 10。承認 accepted を待たず、`implemented` で算入される＝MODEL §2.6「仕様を書くのも進捗」）。50% でなく <b>30%</b>。打鍵の<b>最中</b>（作成中＝implementing）は実行カバレッジが一時 1/3≈33% になるが、これは<b>仕掛中の量であって出来高ではなく</b>、作成完了（implemented）で 0% に戻る（`implementing` を抜けるため）。出来高として残り進むのは EV% 30% の方。部分的な出来高（途中で半分など）は計上しない＝二値（§7）。</small>

### schedule-time 画面 — 人間レビュー待ち一覧（玉が人間）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 キュー（actor フィルタ：人間 ▸ レビュー）（After）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー <b style="color:#b45309">（玉が人間）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義</b>（レビュー待ち＝作成完了・承認前）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
  </tr>
  <tr>
    <td colspan="3" style="padding:6px 10px;border:1px solid #cbd5e1;background:#eff6ff">🔎 フィルタ：<b>自分のレビュー待ちのみ</b> <span style="color:#dc2626">（⚠ 「自分」は視点 actor を要する<b>新規要件</b>＝§7・現状は無効化）</span></td>
  </tr>
</table>

<small>※ 人間レビュー待ち一覧は「`implemented` で人間の承認待ちの葉」を **actor 非依存**に並べる導出（誰が作成したかに依らない）。よって特定の担当者名はこの導出からは出ない（「自分のレビュー待ち」に絞るには視点 actor＝下の §7 の新規要件が要る）。</small>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">🗂 decision インボックス（横断）（After）</td></tr>
  <tr>
    <td colspan="3" style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— 要件定義の「レビュー待ち（承認）」はここには出ない（成果物承認は5コミット判断にも警告にも含まれない＝§7）。レビューは上の人間レビュー待ち一覧で扱う。 —</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 出来高 EV_abs 寄与 | 実行カバレッジ寄与 |
|---|---|---|---|---|
| └ 要件定義 | implemented（レビュー待ち） | agreed（3人日） | ✅ 3人日（完了＝implemented ∧ 合意済み） | ❌（`implementing` でない＝0） |
| └ 設計 | pending | agreed（5人日） | ❌ 未完了＝0 | ❌ |
| └ タスク | pending | agreed（2人日） | ❌ 未完了＝0 | ❌ |

出来高 EV%：**30%**（EV_abs 3 / 合意済み有効**葉**の最新見積総和 3+5+2=10。**葉基底**）<br>
実行カバレッジ：**0%**（`implementing` の合意済み有効**葉** 0 / 3。**葉基底**）／見積カバレッジ（P2）：**75%**（独立合意**ノード** 3 / 既知の有効**ノード** 4〔親 F 含む〕・本ユニットで不変。**ノード基底**）<br>
人間レビュー待ち一覧：**1 件**（要件定義＝`implemented` で人間の承認待ち）

<small>※ 基底に注意：EV% と実行カバレッジは**葉**（req/design/tasks の 3）で測り、見積カバレッジ（P2）は**ノード**（親 F を含む 4）で測る（参照実装 `moira/backend/src/derivations/coverage.ts`：P2=`effectiveNodes` 基底／実行・スケジュールカバレッジ=`effectiveLeaves` 基底）。よって P2 は 75% であって 100% ではない（姉妹ユニット `estimate-spec-agreed` §4/§7 と同値）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | 要件定義の状態を前進させる lifecycle `transition`（作成開始→作成完了。下記 JSON は主要 2 件で、`pending→ready` 等の先行・中間遷移の有無/件数は実装が決める） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-drafted.md`） | 要件定義の作成内容・根拠・「承認はこれから（玉は人間）」 |
| **spec-value 画面 / schedule-time 画面** | 要件定義が「レビュー待ち」になり、出来高 EV% が 30% に上がり、人間レビュー待ち一覧に 1 件出現（§4） |

```json
[
  {
    "id": "e060", "ts": 60,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implementing",
    "reason": "要件定義の作成を開始（kiro-spec-requirements 打鍵）"
  },
  {
    "id": "e061", "ts": 61,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "要件定義ドラフト完成・仕様FIX判定（人間の承認待ち）"
  }
]
```

<small>注：ノード ID・ts 値はいずれも例示であり、実装が決める。lifecycle は `pending → ready → implementing → implemented → accepted`（MODEL §2.5）で、上記は作成の開始・完了に当たる主要遷移を示す（`pending→ready` 等は実装が補い、件数は断定しない）。`implemented` は「実装完了 ∧ 仕様FIX」という**記録上の判定（保証ではない）**（MODEL §2.5・`moira-core` 5.4）。**出来高 EV_abs は完了葉（`implemented` または `accepted`）かつ合意済みの凍結予算を算入する**ため（参照実装 `moira/backend/src/derivations/ev.ts`：`COMPLETED = {implemented, accepted}`／`moira-evm` R1）、`implemented` 到達でこの葉が算入される。作成は Claude（`actor.kind:"agent"`）が行い、**承認 `implemented→accepted`（actor=human）は別ユニット**（出来高は動かさない）。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致する。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が要件定義の作成を打鍵したとき、**システムは** 要件定義の行を「作成中 → 作成完了（レビュー待ち）」へ進め**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高（進捗）を、その要件定義の合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを人間のレビュー待ち一覧に 1 件として現さ**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを横断の decision 一覧（インボックス）に出**してはならない**（レビュー待ちはレビュー一覧で扱う）。
- **WHILE** 要件定義が作成完了だが人間の承認前である間、**システムは** 人間の承認を待たずに出来高をそれ以上増減**してはならない**（承認は品質確認であって出来高を動かさない）。
- **WHEN** 開発者が自分のレビュー待ちだけを見たいとき、**システムは** その開発者自身が担当するレビュー待ちに絞り込める手段を提供**しなければならない**（⚠ これは「いま誰が見ているか（視点）」を要する**新規要件**で、現状は未対応＝§7）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 人間の承認（OK 判断）を自動で行っ**てはならない**（承認は人間）。

## 7. 決定事項

<!-- 検証ループ後に確定した決定のみを記す。 -->

- **「proposed＝承認待ち」は lifecycle の `implemented`:** §3 の「要件定義の行が proposed（承認待ち）になる」は、見積合意の `proposed`（既に `agreed` 済み）ではなく、**lifecycle の `implemented`（作成完了・仕様FIX判定で人間の承認 `implemented→accepted` 待ち）**を指すと解釈する（MODEL §2.5/§2.6・`moira-core` 5.1/5.3/5.4）。
- **出来高 EV% は「作成完了（implemented）」で 0%→30% に上がる（承認を待たない）:** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入する（参照実装 `moira/backend/src/derivations/ev.ts` の `COMPLETED = {implemented, accepted}`、`moira-evm` R1.1。完了状態の語彙は MODEL §2.5・算入規則は R-U8 が定め、R-U13 も「完了状態 = `implemented` または `accepted`」と言及する）。よって要件定義が `implemented` になった時点で EV_abs に 3人日が入り、**EV% = 3 / (3+5+2) = 30%**。**§3 の「進捗が進む」という見立ては正しく、数値が 50% でなく 30%、上がるタイミングが承認前の作成完了**である。これは MODEL §2.6「仕様を書くのも進捗」が `implemented` で実現する正典どおりの挙動。人間の**承認**（`implemented→accepted`）は品質確認であって **EV を動かさない**（同一葉は implemented で既に算入済み）。**部分的な出来高（途中で半分など）は計上しない＝二値**（部分EV獲得ルールは v16 で独立敵対ゲートが却下＝MODEL §6 v15→v16 来歴。現行 MODEL は v17）。打鍵の最中だけ実行カバレッジ（R-S8）が一時 1/3≈33% に上がるが、これは**仕掛中の量であって出来高ではなく**作成完了で 0 に戻る（`moira-evm` R4・`moira-surface-spec-value` 5.3）。なお **EV% は現在状態からの導出であって凍結値ではない**——後にレビューで差し戻し（`implemented→implementing`・別ユニット）が起きれば EV% は 30%→0% に後退しうる（MODEL P5 の EV 非単調）。凍結されるのは出来高そのものではなく、合意時に確定する予算（`frozenBudget`）である。
- **「ガントの進捗バー」は採らない（出来高は spec-value/health で読む）:** §3 の「ガントチャートの方は進捗が…」は、出来高 EV% の host が spec-value（主）・health（副）であり（UI-ARCH §4.1）、ガント（schedule-time）は状態＋予測を描く面である、と接地する。ガントに進捗バー％は出さない（前段 `estimate-spec-proposed` §7 と整合）。
- **「玉が人間」は人間レビュー待ち一覧＋状態バッジの言い換え（新状態を作らない・構造保証ではなく §2.6 の設計記述）:** 作成完了で次の遷移＝承認は人間が行う（MODEL §2.6）。これは **人間レビュー待ち一覧＝`implemented` で人間の承認待ちの葉**（`moira-schedule` 4.3）＋ spec-value の状態バッジ（`moira-surface-spec-value` 1.1）から純粋に導出できる。§4 の「玉＝人間」表示は**その導出の言い換え**であり、MODEL に「玉」という一級の状態・概念を新設しない（ゆえに素値のデータ表には「玉」列を作らない）。なお「承認は人間が行う」は **MODEL §2.6 の設計上の記述**であり、見積合意（`proposed→agreed`）の人間限定が I6 で**構造強制**されるのとは異なる——lifecycle の `implemented→accepted` の actor=human は core が構造的に拒否する不変条件としては置かれていない（core が拒否するのは循環 I2・非人間 agreed I6 のみ＝`moira-core` 5.6）。本ユニットは「玉が人間」を、人間レビュー待ち一覧という導出＋§2.6 の設計記述として提示し、構造保証としては主張しない。
- **decision インボックスには出さない（成果物承認は5判断・警告のいずれでもない）:** decision インボックスが集約するのは5コミット判断のうち4つ（見積合意・割当・スコープ/期日・見積の深さ）＋判断/行為を要する警告（[UI-ARCHITECTURE.md](../../../moira/UI-ARCHITECTURE.md) §3・MODEL §2.1）。**成果物の承認（`implemented→accepted`）はそのどちらにも含まれない**ため、本ユニットでは「decision には出ない／人間レビュー待ち一覧に出る」と確定した。承認を6つ目のコミット判断 or インボックス拡張とするかは MODEL 論点だが、本ユニットでは**現状の正典どおり（出さない）**を採り、MODEL エスカレーションはしない（ユーザーとの対話で確定）。
- **「自分でフィルター」は視点 actor を要する新規要件（assignee とは別・MODEL 変更不要）:** 開発者が「自分のレビュー待ち」だけに絞る機能は、**「いま誰が見ているか（視点 actor）」**に依存する。これは被割当者（assignee）とも、現状の actor 種別フィルタ（全員/人間/エージェント＝`moira-surface-schedule` 8.1）とも別物で、**参照実装では視点 actor 不在のため「自分」は無効化されている**既知ギャップ（[UI-ARCHITECTURE.md](../../../moira/UI-ARCHITECTURE.md) §5）。これは提示層の actor フィルタ（提示の自由・MODEL §2.1/UI-ARCH §2）であって**MODEL 変更を要しない**——`moira-surface-schedule` の新規要件（視点 actor の導入＋自分フィルタ）として起票する（起票後に本ユニットの `touches_requirements` を更新）。§1/§4/§6 の当該記述は、この**未実装の新規要件に対する目標受け入れ基準**であることを ⚠ で標識している。
- **本ユニットの範囲は「打鍵→作成完了・玉が人間へ・出来高 30% 獲得」まで:** 人間の**承認**（`implemented→accepted`・出来高を動かさない品質確認）と、レビューでの**差し戻し**（`implemented→implementing` への後退＝MODEL P5 の「仕様FIX判定の誤り」異常で、解放済み後続が at-risk になりうる）は、いずれも**別ユニット**で扱う（estimate の proposed/agreed を分割したのと同型）。
- **イベント件数は断定しない:** lifecycle は `pending→ready→implementing→implemented`（MODEL §2.5）であり、§5 は作成の開始・完了に当たる主要遷移を示す。`pending→ready` 等の先行・中間遷移の有無/件数は実装（`moira-progress` 仮称・⚠未実装）が決めるため、本ユニットでは件数を確定しない。
