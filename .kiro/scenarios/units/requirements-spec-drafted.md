---
id: units/requirements-spec-drafted
title: 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ）」になり、出来高が上がる
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 要件定義・設計・タスクの見積が合意済みで、要件定義の作業はまだ着手前（pending）
postcondition: 要件定義が「作成完了・レビュー待ち（implemented）」になり、玉（次に動く側）が作成したエージェントから人間（レビュー担当）に渡って人間レビュー待ち一覧に現れ、出来高（EV%）が要件定義分だけ上がる。人間の承認はまだ未実施
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3"
  - "moira-evm: 1.1, 1.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3"
  - "moira-surface-schedule: 2.5, 8.1"
---

# 要件定義を打鍵すると成果物ができ「レビュー待ち（玉が人間へ）」になり、出来高が上がる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスであり、本ユニットは「要件としてどうあるべきか」を記述します。現フロントエンドが未描画の項目は ⚠（新規描画/新規要件）で標識します。

## 1. このユニットで確かめること

見積が合意済みの spec で開発者が要件定義を実際に作る作業（打鍵）を行うと、**要件定義の成果物ができて「レビュー待ち（まだ承認前）」**になり、**そのとき出来高（進捗）が要件定義分だけ上がる**こと（「仕様を書くのも進捗」）。さらに：

- **担当（作業者）が画面で分かる**こと（この打鍵では作成者は Claude＝エージェント）。担当は spec-value と schedule の**両方の画面**に列として出る（⚠ spec-value 側の担当列は現フロントエンド未実装＝新規描画。schedule 側は Inspector に担当表示が実在）。
- **いま動くべき側＝人間（レビュー担当）に玉が渡ったことが画面で分かる**こと。玉が **AI（作成中）→ 人間（レビュー待ち）**へ移ったことは、作業が**エージェント作業キューから人間レビュー待ちキューへ移動**することで分かる。
- この「レビュー待ち＝玉が人間」は**人間のレビュー待ち一覧に現れる**（横断の decision インボックスには出ない）こと。
- 開発者が**自分（例：太郎）のレビュー待ちだけに絞り込める**こと（⚠ 視点 actor を要する新規要件＝後述）。
- schedule の作業詳細を開くと、**予定開始日・予定終了日・実績開始日・実績終了日**と出来高/計画値/実コストが見えること（⚠ 実績開始/終了・予定開始は新規導出＝後述）。

## 2. 前提（Given）

新規 spec `F` のフェーズノード（要件定義・設計・タスク）に見積が合意済みで、要件定義の作業はまだ着手前。

| ノード | 見積状態 | 見積値 | lifecycle | 担当 |
|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — |
| └ 要件定義 | agreed | 3人日 | pending | （打鍵で Claude が着手） |
| └ 設計 | agreed | 5人日 | pending | —（本ユニット対象外） |
| └ タスク | agreed | 2人日 | pending | —（本ユニット対象外） |

見積カバレッジ（P2・**葉基底**＝MODEL v18）：**100%**（合意済み有効葉 3 / 既知の有効葉 3。中間ノード F は I1 ロールアップで独立合意を受けず分母に入らない＝§7）／実行カバレッジ（葉基底）：**0%**（`implementing` の葉なし）／EV%（出来高）：**0%**（完了葉なし）

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

<small>注：「要件定義を打鍵」の実体は `kiro-spec-requirements`。これが Claude（エージェント）として成果物を作る。lifecycle を進める書き込みの実体は `moira-progress`（仮称・⚠未実装）。「レビュー待ち」は lifecycle の `implemented`（＝作成完了・仕様FIX判定で、人間の承認 `implemented→accepted` 待ち）。**「玉が人間」は、作成中（implementing）の間はエージェント作業キューに居た作業が、作成完了（implemented）で人間レビュー待ちキューへ移ることで表れる。担当（作業者）は作成者の Claude のままで、移るのは玉（手番）だけ。** 人間の承認 `implemented→accepted` は別ユニットで、出来高は動かさない品質確認（§7）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・出来高 EV%）＋ schedule-time（担当・玉＝キュー間の移動・作業詳細）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host、ガントは状態＋予測＋詳細のみ＝前段ユニット `estimate-spec-proposed` §7 と整合）。

### 4-1. spec-value 画面（状態・担当・出来高）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value 画面（Before — 着手前）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 <span style="color:#dc2626">⚠新規描画</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（中間ノード＝独立見積なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>0%</b>・実行 <b>0%</b>・見積カバレッジ(P2) <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（これから Claude）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value 画面（After — 要件定義が作成完了・レビュー待ち）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 <span style="color:#dc2626">⚠新規描画</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（中間ノード＝独立見積なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#16a34a">30%</b>（0%→30%）・実行 <b>0%</b>・見積カバレッジ(P2) <b>100%</b>（不変）<br><span style="color:#b45309">⚑ レビュー待ち 1 件（玉＝人間）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（レビュー待ちとして強調）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#94a3b8;font-size:11px">作成者</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3人日</b>（＝自分の予算満額・二値）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>要件定義「単体」の出来高は EV寄与＝3人日（自分の凍結予算の満額。割合なら 100%・二値）</b>。打鍵で出力＝作成完了（implemented）になった瞬間に満額計上され、<b>50% にはならない</b>（途中の部分点は無い＝部分EV は MODEL v16 で却下）。<b>フィーチャー全体の出来高 EV% は 0%→30%</b>（要件定義の凍結予算 3 ÷ 合意済み葉の総和 3+5+2=10＝MODEL v18 P2/P1 とも葉基底）。「進捗が進む」という §3 の見立ては正しく、数値は 50% でなく 30%、上がるタイミングは承認前の作成完了。打鍵の<b>最中</b>（implementing）は実行カバレッジが一時 1/3≈33% になるが、これは<b>仕掛中の量であって出来高ではなく</b>、作成完了で 0% に戻る。</small>

### 4-2. schedule-time 画面 — 玉の受け渡し（エージェント作業キュー → 人間レビュー待ちキュー）

「玉が AI→人間に変わった」ことは、作業が**2つのキューの間を移動**することで分かる（玉という一級の状態を新設せず、lifecycle から導出＝§7）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 作成中（打鍵の最中・implementing）— 玉＝AI</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義（作成中）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 作成完了（implemented）— 玉＝人間（After）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）← 要件定義はここから抜けた</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b> <span style="color:#dc2626">⚠新規描画</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義</b>（レビュー待ち＝作成完了・承認前）<span style="color:#b45309"> ◀ 玉＝人間</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><span style="color:#94a3b8;font-size:11px"> 作成者</span></td>
  </tr>
</table>

<small>※ 玉が動いても**担当（作業者）は Claude のまま**——担当列は「誰が作った/やる作業か」を表し、玉（手番）は lifecycle から導出される別概念（§7）。人間レビュー待ちキューは「`implemented` で人間の承認待ちの葉」を **actor 非依存**に並べる導出（`moira-schedule` 4.3）。導出は参照実装の backend に存在するが、**一覧としての画面描画は未実装＝⚠新規描画**（現状は spec-value の `implemented` バッジで読む）。</small>

### 4-3. schedule-time 画面 — 「自分のレビュー待ち」フィルタ（⚠ 新規要件：視点 actor）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🔎 キュー絞り込み（actor フィルタ）</td></tr>
  <tr>
    <td style="padding:8px 10px;border:1px solid #cbd5e1;width:160px">フィルタ</td>
    <td style="padding:8px 10px;border:1px solid #cbd5e1">
      <span style="border:1px solid #1e3a8a;background:#dbeafe;color:#1e3a8a;border-radius:999px;padding:2px 10px">全員</span>
      <span style="border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:999px;padding:2px 10px">人間（レビュー/作業）</span>
      <span style="border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:999px;padding:2px 10px">エージェント</span>
      <span style="border:1px dashed #cbd5e1;background:#f1f5f9;color:#94a3b8;border-radius:999px;padding:2px 10px" title="視点 actor が未実装">自分（太郎）<span style="color:#dc2626">⚠新規・現状は無効</span></span>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 10px;border:1px solid #cbd5e1">「自分（太郎）」選択時<br>の期待結果</td>
    <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#eff6ff">
      人間レビュー待ちキューのうち <b>太郎がレビュー担当の項目だけ</b>に絞り込まれる：<br>
      ▸ <b>要件定義</b>（レビュー待ち・玉＝太郎）<br>
      <span style="color:#dc2626">⚠ これは「いま誰が見ているか（視点 actor）」を要する<b>新規要件</b>。現状の actor フィルタは種別（全員/人間/エージェント）のみで、特定個人の「自分」は無効化されている（§7）。</span>
    </td>
  </tr>
</table>

### 4-4. schedule-time 画面 — 作業の詳細（クリックで開く・予定/実績の開始終了日）

要件定義の行をクリックすると詳細が開き、**予定開始日・予定終了日・実績開始日・実績終了日**と EVM（出来高 EV／計画値 PV／実コスト AC）が見える。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#0f766e;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 詳細：要件定義（After — 作成完了）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:200px">状態</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち（implemented）</span>／担当 🤖 Claude（作成者）／玉＝人間</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定開始日（ベースライン）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-05 <span style="color:#dc2626">⚠新規導出</span></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">予定終了日（基準完了日 frozenSlot）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-07（値は例示）<span style="color:#16a34a"> ／ フィールドは実在：Inspector「基準完了日」</span></td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績開始日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-05 <span style="color:#dc2626">⚠新規導出</span>（作成開始 `→implementing` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">実績終了日</td><td style="padding:6px 10px;border:1px solid #cbd5e1">2026-01-07 <span style="color:#dc2626">⚠新規導出</span>（作成完了 `→implemented` の時刻）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">3</b>（完了∧合意済み＝凍結予算満額・二値）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">計画値 PV ／ 実コスト AC（MD）</td><td style="padding:6px 10px;border:1px solid #cbd5e1">PV 3 ／ AC 3（いずれも例示・実装が定める）</td></tr>
</table>

<small>※ 詳細パネル自体は実在（schedule の Inspector）。<b>予定終了日</b>のフィールドも実在（Inspector「基準完了日」＝凍結スロット `frozenSlot`・MODEL §3②）。<b>予定開始日・実績開始日・実績終了日</b>は ⚠新規（**表示フィールドも導出も未実装**）：実績は lifecycle `transition` の時刻（`→implementing`＝実績開始、`→implemented`＝実績終了）から導け、予定開始は予定終了−所要から導く（基底＝要定義；MODEL は完了スロットのみ凍結し開始日を一級では持たない＝§7）。**日付の値はすべて例示**で実装が定める（上の「実在」はフィールドの存在を指し、日付値ではない）。作成中（implementing）に詳細を開いた場合は実績終了日が「未」になる（表示バリアントは新規要件側に委ねる＝§7）。</small>

### 4-5. decision インボックス（横断）— 要件定義のレビューは出ない

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">🗂 decision インボックス（横断）（After）</td></tr>
  <tr>
    <td style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— 要件定義の「レビュー待ち（承認）」はここには出ない（成果物の承認はコミット判断4種にも判断要警告にも含まれない＝§7）。レビューは上の人間レビュー待ちキューで扱う。 —</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | 出来高 EV_abs 寄与 | 実行カバレッジ寄与 |
|---|---|---|---|---|---|
| └ 要件定義 | implemented（レビュー待ち） | agreed（3人日） | Claude（agent） | ✅ 3人日（完了＝implemented ∧ 合意済み） | ❌（`implementing` でない＝0） |
| └ 設計 | pending | agreed（5人日） | —（対象外） | ❌ 未完了＝0 | ❌ |
| └ タスク | pending | agreed（2人日） | —（対象外） | ❌ 未完了＝0 | ❌ |

出来高 EV%：**30%**（EV_abs 3 / 合意済み有効**葉**の最新見積総和 3+5+2=10。**葉基底**）<br>
実行カバレッジ：**0%**（`implementing` の合意済み有効**葉** 0 / 3。**葉基底**）／見積カバレッジ（P2）：**100%**（合意済み有効**葉** 3 / 既知の有効**葉** 3。**葉基底**・本ユニットで不変）<br>
人間レビュー待ちキュー：**1 件**（要件定義＝`implemented` で人間の承認待ち）

<small>※ 基底に注意：EV%・実行カバレッジ・**見積カバレッジ(P2) はいずれも葉基底**（req/design/tasks の 3 葉）で測る（MODEL v18 で P2 をノード基底→葉基底へ是正＝参照実装 `moira/backend/src/derivations/coverage.ts` の `effectiveLeaves` 基底に統一）。中間ノード F は I1 ロールアップで独立合意を受けず分母に入らない。よって**全葉合意で P2 = 100%**（姉妹ユニット `estimate-spec-agreed` も v18 同期で 100%）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | 要件定義の状態を前進させる lifecycle `transition`（作成開始→作成完了。actor＝Claude＝agent、作成開始遷移に assignee も載る。下記 JSON は主要 2 件で、`pending→ready` 等の先行・中間遷移の有無/件数は実装が決める） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-drafted.md`） | 要件定義の作成内容・根拠・「承認はこれから（玉は人間）」 |
| **spec-value 画面 / schedule-time 画面** | 要件定義が「レビュー待ち」になり、担当 Claude が出て、玉がエージェント作業キュー→人間レビュー待ちキューへ移り、出来高 EV% が 30% に上がる（§4） |

```json
[
  {
    "id": "e060", "ts": 60,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
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

<small>注：ノード ID・ts 値はいずれも例示であり、実装が決める。lifecycle は `pending → ready → implementing → implemented → accepted`（MODEL §2.5）で、上記は作成の開始・完了に当たる主要遷移を示す。**作成開始 `→implementing` に `assignee`（Claude＝agent）が載ることで、作成中は当該葉がエージェント作業キューに入る**（`agentWorkQueue` ＝ `{ready, implementing}` ∧ assignee.kind=agent；参照実装 `queues.ts`）。`implemented` 到達で当該葉は人間レビュー待ちキュー（`humanReviewQueue` ＝ `implemented` の葉・actor 非依存）へ移る。`implemented` は「実装完了 ∧ 仕様FIX」という**記録上の判定（保証ではない）**（MODEL §2.5・`moira-core` 5.4）。**出来高 EV_abs は完了葉（`implemented` または `accepted`）かつ合意済みの凍結予算を算入**（参照実装 `ev.ts`：`COMPLETED = {implemented, accepted}`／`moira-evm` R1）。作成は Claude（`actor.kind:"agent"`）が行い、**承認 `implemented→accepted`（actor=human）は別ユニット**（出来高は動かさない）。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致する。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が要件定義の作成を打鍵したとき、**システムは** 要件定義の行を「作成中 → 作成完了（レビュー待ち）」へ進め**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高（進捗）を、その要件定義の合意済み見積分だけ上げ**なければならない**（作成完了で出来高が上がる）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 出来高を途中段階の部分的な割合では計上**してはならない**（出来高は作成完了で初めて満額算入する＝二値）。
- **WHILE** 要件定義を作成している（作成中の）間、**システムは** 担当（作業者）を画面に示し、当該作業をエージェント作業キュー（玉＝エージェント）に現さ**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 当該作業をエージェント作業キューから外し人間レビュー待ちキューへ移し、いま動くべき側が人間（レビュー担当）であることを画面で分かるように示さ**なければならない**（玉がエージェント→人間へ移ったことが分かる）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを人間のレビュー待ち一覧に 1 件として現さ**なければならない**。
- **WHEN** 要件定義が作成完了になったとき、**システムは** それを横断の decision 一覧（インボックス）に出**してはならない**（レビュー待ちはレビュー一覧で扱う）。
- **WHILE** 要件定義が作成完了だが人間の承認前である間、**システムは** 人間の承認を待たずに出来高をそれ以上増減**してはならない**（承認は品質確認であって出来高を動かさない）。
- **WHEN** 各作業が画面に表示されるとき、**システムは** その担当（作業者）を spec-value と schedule の両方で一目で分かるように示さ**なければならない**。
- **WHEN** 開発者が作業の詳細を開いたとき、**システムは** 予定開始日・予定終了日・実績開始日・実績終了日と、出来高（EV）・計画値（PV）・実コスト（AC）を示さ**なければならない**（⚠ 実績開始/終了・予定開始は新規導出＝§7）。
- **WHEN** 開発者が自分のレビュー待ちだけを見たいとき、**システムは** その開発者自身が担当するレビュー待ちに絞り込める手段を提供**しなければならない**（⚠ これは「いま誰が見ているか（視点）」を要する**新規要件**で、現状は未対応＝§7）。
- **WHEN** 要件定義が作成完了になったとき、**システムは** 人間の承認（OK 判断）を自動で行っ**てはならない**（承認は人間）。

## 7. 決定事項

<!-- 検証ループ後に確定した決定のみを記す。 -->

- **「レビュー待ち＝提案された」は lifecycle の `implemented`:** §3 の「要件定義の行が『レビュー待ち（提案された・まだ承認前）』になる」は、見積合意の `proposed`（既に `agreed` 済み）ではなく、**lifecycle の `implemented`（作成完了・仕様FIX判定で人間の承認 `implemented→accepted` 待ち）**を指すと解釈する（MODEL §2.5/§2.6・`moira-core` 5.1/5.3/5.4）。
- **出来高 EV% は「作成完了（implemented）」で 0%→30% に上がる（承認を待たない）:** 出来高 EV_abs は**完了葉（`implemented` または `accepted`）かつ合意済み**の凍結予算を算入する（参照実装 `ev.ts` の `COMPLETED = {implemented, accepted}`、`moira-evm` R1.1）。要件定義が `implemented` になった時点で EV_abs に 3人日が入り、**EV% = 3 / (3+5+2) = 30%**。**§3 の「進捗が進む」見立ては正しく、数値が 50% でなく 30%、上がるタイミングが承認前の作成完了**である（MODEL §2.6「仕様を書くのも進捗」が `implemented` で実現）。人間の**承認**（`implemented→accepted`）は品質確認であって **EV を動かさない**。**部分的な出来高（途中で半分など）は計上しない＝二値**（部分EV獲得ルールは MODEL v16 で独立敵対ゲートが却下）。なお **EV% は現在状態からの導出であって凍結値ではない**——後にレビューで差し戻し（`implemented→implementing`・別ユニット）が起きれば EV% は 30%→0% に後退しうる（MODEL P5 の EV 非単調）。
- **要件定義「単体」の出来高は EV寄与＝3人日（二値・割合なら100%）。50% にはならない:** per-node の「EV%」表示は実装に無く（per-task は二値＝Inspector 注記）、要件定義単体の出来高は **(a) spec-value ノード木/被覆表の「EV寄与 3」、(b) schedule 詳細（Inspector）の「EV 出来高 3」**で読む（参照実装 `SpecValueSurface.tsx`・`Inspector.tsx`）。出力＝implemented＝満額計上で、「出力したが未承認だから半分（50%）」という途中点は存在しない。フィーチャー全体の EV%（30%）と per-node の二値出来高（3人日）は別の読み。
- **見積カバレッジ(P2) は葉基底＝全葉合意で 100%（MODEL v18 で是正）:** §2/§4 の見積カバレッジは **100%**（合意済み有効葉 3 / 既知の有効葉 3）。これは MODEL v18 で **P2 をノード基底（親を分母に含む＝旧75%）から葉基底へ是正**した結果（出所＝MODEL §3 P2・§6 v17→v18 来歴・§7#17、参照実装 `coverage.ts` の `effectiveLeaves` 基底）。中間ノード F は I1 で原始的見積を持たず Σ(合意済み子) のロールアップゆえ独立合意の対象でない（§7#14(d)）ため分母に入らない。よって req/design/tasks を全葉合意した本ユニットの前提では **P2 = 100%**（旧版の 75% から是正）。この是正は受け入れシナリオレビュー（本作業）で人間が「全葉合意なのに 75% は直感に反する」と指摘し、`moira-model-update` の独立敵対ゲートを PASS して確定した（姉妹ユニット `estimate-spec-proposed`/`estimate-spec-agreed` の 75% 表記も v18 同期で 100% に更新する）。
- **担当（作業者）列を spec-value と schedule の両面に出す。担当 ≠ 玉:** 担当（assignee）は「その作業を誰がやる/やったか」を表す（MODEL §2.4・`moira-core` 6.x）。この打鍵では作成者は **Claude（agent）**（§5 の actor=claude；エージェント作業キュー所属には assignee.kind=agent が要る）。**玉（次の手番）は担当とは別概念**で、lifecycle から導出される（`implementing`→エージェント作業キュー、`implemented`→人間レビュー待ちキュー＝actor 非依存）。ゆえに**担当列だけでは玉は表せない**——作成完了後も担当は Claude のままで、移るのは玉（人間レビューへ）だけ。担当列は両画面に出すが、玉は「2キュー間の移動＋状態バッジ」で示す。なお人間レビュー担当の固有名（太郎）はレビューキュー導出（actor 非依存）からは出ず、「自分のレビュー」に絞るには下記の視点 actor が要る。
- **担当（作業者）は本ユニットでは Claude（agent）。assign-spec-provisional（暫定割当＝人間 太郎）とは別パス:** 本ユニットの precondition は割当の有無を要求せず、打鍵（`kiro-spec-requirements`）を実行する Claude（agent）が作業者として `→implementing` 遷移に `assignee`=agent で記録される（§5）。これは「AI が要件定義を作る」パスであり、人間に計画割当する [assign-spec-provisional](./assign-spec-provisional.md)（太郎）とは別シナリオ。仮に先に人間が暫定割当されていても、実際に作業する actor の名指し（latest-wins）で作業者は Claude になる（MODEL §2.4）。§2 の担当列「（打鍵で Claude が着手）」はこの意（事前の人間割当を前提としない）。
- **完全性（スコープの正直化）:** §4 は happy path（着手前→作成中→作成完了）を描く。作成中（implementing）に詳細を開いた場合の「実績終了日＝未」、自分フィルタの該当0件/複数件、`pending→ready→implementing` の中間遷移の可視化は、いずれも当該**新規要件**（詳細画面・視点 actor フィルタ）の表示バリアントとして実装に委ね、本ユニットでは確定しない（件数・中間遷移は実装定義＝下記「イベント件数は断定しない」）。
- **「玉が人間」は2キュー間の移動の言い換え（新状態を作らない）:** 「玉が AI→人間」は、作業が**エージェント作業キュー（implementing・assignee=agent）から人間レビュー待ちキュー（implemented・actor 非依存）へ移動**することで表れる（`moira-schedule` 4.1/4.3・`queues.ts`）。MODEL に「玉」という一級の状態・概念は新設しない（grep 上も MODEL に「玉」概念なし）。**人間レビュー待ちキューの導出は backend に存在するが、一覧としての画面描画は現フロントエンド未実装＝⚠新規描画**（現状は spec-value の `implemented` バッジで読む）。
- **schedule 詳細の4日付：予定終了は実在、予定開始・実績開始・実績終了は新規導出:** 詳細画面（クリックで開く Inspector 相当）の **予定終了日＝凍結スロット `frozenSlot`**（MODEL §3② の基準完了日）は実在（`Inspector.tsx` 「基準完了日」）。**実績開始/終了**は lifecycle `transition` の時刻（`→implementing`／`→implemented`）から導ける**新規導出**、**予定開始**は予定終了−所要から導く**新規導出**（MODEL は完了スロットのみ凍結し開始日を一級では持たないため、開始の基底＝要定義として ⚠ で標識）。これらは提示層の導出（MODEL 変更を要しない）として新規要件に起票する。
- **「ガントの進捗バー」は採らない（出来高は spec-value/health で読む）:** 出来高 EV% の host は spec-value（主）・health（副）であり（UI-ARCH §4.1）、ガント（schedule-time）は状態＋予測＋詳細を描く面である、と接地する。ガントに進捗バー％は出さない（前段 `estimate-spec-proposed` §7 と整合）。
- **decision インボックスには出さない（成果物承認は4コミット判断・警告のいずれでもない）:** decision インボックスが集約するのは5コミット判断のうち4つ（見積合意・割当・スコープ/期日・見積の深さ。**第5＝c〔容量〕宣言は capacity 面ゆえインボックス外**）＋判断/行為を要する警告（[UI-ARCHITECTURE.md](../../../moira/UI-ARCHITECTURE.md) §3・MODEL §2.1）。**成果物の承認（`implemented→accepted`）はそのどちらにも含まれない**ため、「decision には出ない／人間レビュー待ちキューに出る」と確定した（現状の正典どおり；MODEL エスカレーションはしない）。
- **「自分でフィルター」は視点 actor を要する新規要件（assignee とは別・MODEL 変更不要）:** 開発者が「自分（太郎）のレビュー待ち」だけに絞る機能は、**「いま誰が見ているか（視点 actor）」**に依存する。これは被割当者（assignee）とも、現状の actor 種別フィルタ（全員/人間/エージェント＝`moira-surface-schedule` 8.1）とも別物で、**参照実装では視点 actor 不在のため「自分」は無効化されている**既知ギャップ（[UI-ARCHITECTURE.md](../../../moira/UI-ARCHITECTURE.md) §5）。これは提示層の actor フィルタ（提示の自由・MODEL §2.1/UI-ARCH §2）であって**MODEL 変更を要しない**——`moira-surface-schedule` の新規要件（視点 actor の導入＋自分フィルタ）として起票する。§1/§4/§6 の当該記述は、この**未実装の新規要件に対する目標受け入れ基準**であることを ⚠ で標識している。
- **参照実装は暫定スライス・本ユニットは「あるべき要件」を記述:** 担当列（spec-value 側）・人間レビュー待ちキューの一覧描画・自分フィルタ・詳細の予定/実績日のうち、現フロントエンド未実装のものは ⚠ で標識した。これらは MODEL/spec が定める「あるべき姿」への目標受け入れ基準であり、現スライスの挙動に縛られない（ユーザー方針）。
- **本ユニットの範囲は「打鍵→作成完了・玉が人間へ・出来高 30% 獲得」まで:** 人間の**承認**（`implemented→accepted`・出来高を動かさない品質確認）と、レビューでの**差し戻し**（`implemented→implementing` への後退＝MODEL P5）は、いずれも**別ユニット**で扱う。
- **イベント件数は断定しない:** lifecycle は `pending→ready→implementing→implemented`（MODEL §2.5）であり、§5 は作成の開始・完了に当たる主要遷移を示す。`pending→ready` 等の先行・中間遷移の有無/件数は実装（`moira-progress` 仮称・⚠未実装）が決めるため、本ユニットでは件数を確定しない。
