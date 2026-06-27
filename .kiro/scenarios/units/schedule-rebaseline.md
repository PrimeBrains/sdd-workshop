---
id: units/schedule-rebaseline
title: 遅延を正式計画へ織り込む — 理由付き再ベースラインで基準完了日を引き直し、遅延標識が解除される
status: agreed
language: ja
actor: 開発者
surfaces: [schedule-time]
precondition: Z 優先の組み替えで Y/要件定義の予測（7/5）が凍結ベースライン（7/3）を超え「遅延」表示になっている（schedule-reorder の後）
postcondition: Y の基準完了日が理由付きで 7/3→7/5 に再ベースラインされ、予測＝基準となって遅延標識が解除される（元の 7/3 と理由はログに残る）
touches_specs:
  - moira-schedule
  - moira-core
  - moira-surface-schedule
touches_requirements:
  - "moira-schedule: 6.1, 6.3, 12.1, 12.2"
  - "moira-core: 3.1, 5.1, 7.1, 7.3, 7.4"
  - "moira-surface-schedule: 2.2, 6.1, 6.4, 15.2"
---

# 遅延を正式計画へ織り込む — 理由付き再ベースラインで基準完了日を引き直し、遅延標識が解除される

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

Z を優先する組み替えで Y の予測完了日が基準（7/3）を超え「遅延」と出ている状態で、開発者が「この遅れは意図した正式な計画変更だ」と判断したとき、**Y の基準完了日そのものを 7/3 から 7/5 へ理由付きで凍結し直せる**こと（再ベースライン）。引き直した結果、予測（7/5）＝新基準（7/5）となって**遅延標識が解除**され、「実態として遅延していない」状態になること。そしてこれが**自動の予測導出ではなく人間の明示的な書き込み**であり、**元の 7/3 と変更理由はログに残る**（監査可能・履歴不滅）こと。

## 2. 前提（Given）

[schedule-reorder](./schedule-reorder.md) の**終了状態を前提として引き継ぐ独立ユニット**（各ユニットは precondition で自足し、イベント id は共有しない＝§5 注）。Z を Y より先に組み替えた結果、Y の生きた予測が基準を追い越して「遅延」表示になっている。Y はまだ着手前（ready）。

| ノード | 見積状態 | 見積値 | 担当 | lifecycle | 基準完了日（凍結スロット） | 予測完了日（生きた予測） | 遅延標識（R-S7） |
|---|---|---|---|---|---|---|---|
| Y/要件定義 | agreed | 3人日 | 太郎 | ready | 2026-07-03 | 2026-07-05 | **遅延中（+2日・予測>基準）** |
| Z/要件定義 | agreed | 2人日 | 太郎 | ready | 2026-07-05 | 2026-07-02 | 前倒し（−3日・対象外） |

太郎の日次容量：1.0人日/日（既定）。今日は 2026-07-01。Y は未完了（再ベースライン可）。

## 3. ふるまい（When / Then）

```
When  Z を優先した組み替えで Y の予測（7/5）が基準（7/3）を超えて遅延表示になっている状態で、
      開発者が「この遅れは織り込み済みの正式な計画変更だ」と判断し、
      Y の基準完了日を 7/3 から 7/5 へ理由付きで凍結し直す（再ベースライン）。
Then  システムは Y の凍結ベースライン（基準完了日）を 7/5 へ更新する（変更理由の記録を必須とする）。
And   Y の予測完了日（7/5）が新しい基準（7/5）と一致し、「遅延」標識が解除される
      （＝実態として遅延していない状態になる）。
And   元の基準 7/3・再ベースラインの事実・理由・実施者はログに残る（追記専用ゆえ履歴は消えない）。
And   これは自動の予測導出ではなく人間の明示的な書き込みであり、予測導出が基準を勝手に
      動かしたわけではない（基準を動かすのは理由付き再ベースラインだけ）。
```

<small>注：「再ベースライン」は凍結属性の理由付き改訂で、未完了サブ単位の基準スロットを引き直す（MODEL §3・[MODEL.md:217](../../moira/MODEL.md)）。これは **SPEC で明示的に許された操作**——moira-core 7.3 が「初回スケジュールのスロットは**明示的な理由付き再ベースラインを除き**不変」と例外を明文化し（[requirements.md:140](../../.kiro/specs/moira-core/requirements.md)）、7.4 が完了時の I4 施錠を規定する（[requirements.md:142](../../.kiro/specs/moira-core/requirements.md)）。ゆえに Req12 AC2 が禁じる「**予測導出中**の基準上書き」とは矛盾しない——AC2 の不可侵は自動 forecast 導出に対するもので（[requirements.md:185](../../.kiro/specs/moira-schedule/requirements.md)）、人間が明示的に発行する理由付き再ベースラインの書き込みは core 7.3 が別経路として認める。「遅延標識の解除」は moira-schedule 6.3（[requirements.md:103](../../.kiro/specs/moira-schedule/requirements.md)：理由付き再ベースラインがスロットを引き直したとき、または予測がスロットへ再収束したときにのみ解除）。**⚠ 重要：この挙動は core 7.3 が SPEC として許可（carve-out）するが義務化はしておらず、その write は `moira-rebaseline`（⚠未実装）skill 所有・現行 engine（fold.ts）のガード拡張も要る**——詳細は §7 #1。ノード ID・ts 値はユニット内ローカルの例示（他ユニットの同名 ID と同一実体を指さない）。</small>

## 4. 画面の変化（Before → After）

採用表現は実装 `ScheduleGantt.tsx` に接地（破線＝凍結PMB帯／実線＝生きたEACバー／橙=遅れ・緑=先行）。各ノードを **基準┄（凍結帯）／予測█（生きたバー）の2段** で示す。**前ユニットとの違い**：reorder では破線帯（基準）は動かず実線バーだけ動いた。本ユニットでは **破線帯そのものが動く**（Y の基準が 7/3→7/5 へ引き直され、予測バーと一致＝遅れ解消）。Z は据え置きゆえ先行（緑）のまま。縦 ┊ は asOf（7/1）。

### schedule-time ガントチャート

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12px;width:100%">
  <tr style="background:#374151;color:#fff">
    <td style="padding:5px 8px;width:230px">📅 schedule-time（Before — Y 遅延中）</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/1┊</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/2</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/3</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/4</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/5</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/6</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 👤太郎 — 基準┄（凍結7/3）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄7/3</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 — 予測█（生きた7/5・遅れ）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td colspan="3" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#d97706;color:#fff">予測█ →7/5（基準を2日超過＝橙）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Z/要件定義 👤太郎 — 予測█→7/2／基準┄7/5（先行）</td>
    <td colspan="2" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#16a34a;color:#fff">予測█→7/2</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #4c1d95;color:#4c1d95">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #4c1d95;color:#4c1d95">┄7/5</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff">
    <td style="padding:5px 8px;width:230px">📅 schedule-time（After — Y 再ベースライン済み）</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/1┊</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/2</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/3</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/4</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/5</td>
    <td style="padding:5px 8px;text-align:center;width:48px">7/6</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 👤太郎 — 基準┄（<b>引き直し7/5</b>）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄7/5</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 — 予測█（生きた7/5・基準と一致）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td colspan="3" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#3b82f6;color:#fff">予測█ →7/5（基準と一致＝計画通り）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Z/要件定義 👤太郎 — 予測█→7/2／基準┄7/5（先行・据え置き）</td>
    <td colspan="2" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#16a34a;color:#fff">予測█→7/2</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #4c1d95;color:#4c1d95">┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #4c1d95;color:#4c1d95">┄7/5</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
</table>

<small>※ 実線バー（生きた予測）は Y=7/3〜7/5 で Before/After 不変。動いたのは **Y の破線帯（基準）が 7/3→7/5 へ**引き直されたこと。引き直し後は予測バー末端と基準帯末端が一致し、橙（遅れ）が消えて計画通り（青）になる。**Z は据え置きゆえ先行（緑・予測7/2＜基準7/5）のまま**——Z の乖離標識は本ユニットでは解除されない（§7 #6）。担当は実装ではラベル列のアバターで示す。</small>

### 作業詳細（Inspector）— Y/要件定義をクリック

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:380px;margin-top:6px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 Inspector — Y/要件定義（Before — 遅延中）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b;width:210px">基準完了日（ベースライン）</td><td style="padding:4px 10px;border:1px solid #cbd5e1">2026-07-03</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">予測完了日（生きた予測）</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#dc2626">2026-07-05</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">遅延標識</td><td style="padding:4px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px;color:#92400e">予測 2026-07-05 が基準 2026-07-03 に遅延（R-S7）</span></td></tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:380px;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 Inspector — Y/要件定義（After — 再ベースライン済み）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b;width:210px">基準完了日（ベースライン）</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#16a34a"><b>2026-07-05（7/3 から引き直し）</b></td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">予測完了日（生きた予測）</td><td style="padding:4px 10px;border:1px solid #cbd5e1">2026-07-05</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">遅延標識</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#16a34a">なし（予測＝基準・解除済み）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">再ベースライン理由</td><td style="padding:4px 10px;border:1px solid #cbd5e1">Z 優先の組み替えを正式計画へ反映（7/3→7/5）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">履歴（ログ）</td><td style="padding:4px 10px;border:1px solid #cbd5e1">初回凍結 7/3 ＋ 再ベースライン 7/5（理由付き・本ユニット e080）の両方が追記専用ログに残存</td></tr>
</table>

**データ（素の値）**

| | ノード | lifecycle | 基準完了日（frozenSlot） | 予測完了日（predicted） | 遅延標識（R-S7） |
|---|---|---|---|---|---|
| Before | Y/要件定義 | ready | 2026-07-03 | 2026-07-05 | **遅延中（+2日）** |
| After | Y/要件定義 | ready | **2026-07-05（引き直し）** | 2026-07-05 | **解除（予測＝基準）** |

陳腐化スロット数（R-S7）：**Y について** Before 1 → After **0**（再ベースラインで解除）。ただし **Z は据え置きゆえ先行（ahead）の乖離が残る**ため、**プロジェクト全体の陳腐化スロットは After も 1 件（Z）**——本ユニットが解除するのは Y の遅れだけ（Z は §7 #6）。
ログ上の凍結スロット履歴：Y は 7/3（初回凍結）→ 7/5（再ベースライン・本ユニット e080）。**current 値は 7/5・初回 7/3 も追記専用ログに残る**（履歴不滅）。

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | transition イベントが **1 件** 追記される（frozenSlot＋reason 付き・下記 JSON）。新イベント種別は増やさない |
| **会話ログ**（`.kiro/conversations/{日付}-schedule-rebaseline.md`） | 再ベースライン判断（なぜ正式な計画変更とみなすか）の記録 |
| **schedule-time 画面** | Y の基準帯（破線）が 7/3→7/5 へ移動して予測バーと一致し、遅れ（橙）が計画通り（青）へ。Z の先行（緑）は据え置き（§4） |

```json
[
  {
    "id": "e080", "ts": 80,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "Y/req",
    "machine": "lifecycle",
    "to": "ready",
    "frozenSlot": "2026-07-05",
    "reason": "Z 優先の組み替えを正式計画へ反映し、Y の完了予定を 7/3→7/5 に再ベースライン"
  }
]
```

<small>注：基準スロットは lifecycle `transition` の `frozenSlot` 属性に乗る（初回スケジュール載せと同型——[schedule-leveled](./schedule-leveled.md) で扱った →ready 凍結と同じ機構。イベント ID はユニット内ローカルの例示で、同名 ID が他ユニットと同一実体を指すわけではない）。Y は既に `ready` ゆえ **状態保持の自己遷移**（to=ready）で属性だけを改訂する（assign-spec-provisional の暫定割当が状態保持遷移に assignee を載せるのと同型）。`reason` は再ベースラインで**必須**（R-U7＝[MODEL.md:260](../../moira/MODEL.md)。参照実装の型は [types.ts:58](../../moira/backend/src/types.ts) の `reason?` フィールド——なお同コメント内のアンカー `MODEL:232` は R-U7 定義行=260 を指すべき誤記で、これは types.ts 側の軽微なドリフト〔fact-check C6〕）。これにより遅れ標識が moira-schedule 6.3 で解除される。

**⚠ 実装ギャップ（§7 #1）:** 現行 engine（[fold.ts:113-118](../../moira/backend/src/fold.ts)）は `n.frozenSlot === null` ガードで **初回スロットのみ記録し、後続の frozenSlot（reason 付きでも）を無視する**——つまりこの e080 は現状の engine では frozenSlot を更新しない。本ユニットの挙動は **moira-core 7.3 が SPEC として許可（carve-out）するが義務化はしておらず**、その write は `moira-rebaseline`（⚠未実装）skill 所有、かつ engine ガードの拡張（reason 付き＝未完了なら上書き／完了なら I4 拒否）も要る＝**2層の実装タスク**（MODEL/spec 側に欠陥は無い。詳細は §7 #1）。ノード ID・ts 値は例示。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 人間が理由付きで或る未完了の作業の基準完了日を引き直したとき、**システムは** その凍結ベースライン（基準完了日）を新しい値へ更新**しなければならない**（変更理由の記録を必須とする）。
- **WHEN** 再ベースラインで基準が予測と一致したとき、**システムは** その遅れの標識を解除**しなければならない**。
- **WHEN** 再ベースラインを記録するとき、**システムは** 元の基準値・変更理由・実施者をログに残し（追記専用・履歴不滅）、過去のベースラインを物理的に消去**してはならない**。
- **WHEN** 自動の予測導出（平準化）が走るとき、**システムは** 凍結ベースラインを上書き**してはならない**（基準を動かすのは人間の明示的な理由付き再ベースラインのみ）。
- **WHEN** 再ベースラインするとき、**システムは** 新しい記録の種類を増やさず、既存の記録手段（変更理由付きの状態記録）として記録**しなければならない**。

<small>注（記号対応・本文からは外して平文に保つ＝非専門家が §1〜§4・§6 でチェックできるように）：上の「遅れの標識」と解除条件は R-S7／R-S7 6.3、自動導出での基準不可侵は moira-schedule 12.2（Req12 AC2）、理由付き凍結値改訂は moira-core 7.1/7.3、「新しい記録の種類を増やさない」は 4 イベントの `transition`（reason 付き凍結属性改訂）に対応する。なお**完了済みの作業は再ベースラインを受け付けない**（I4 施錠＝moira-core 7.4）が、本ユニットは未完了 Y のみを扱い完了ノードを場に持たないため、この否定系はここでは実演しない（§7 #4）。</small>

## 7. 決定事項

<!-- 検証ループ前のドラフト。対話で確定した決定＋grounding で出た実装ギャップをここに記す。 -->

- **🔴 最重要：理由付き再ベースラインは SPEC が「許可」するが write は未実装・engine ガードも拡張要（MODEL 欠陥ではない）:** 本ユニットの核「frozenSlot を 7/3→7/5 へ更新」について正典の所在を正確に切り分ける（当初ドラフトの「SPEC が義務化済み」は不正確で、doc-adversary R2 で是正）：
  - **MODEL/spec は正しい（欠陥なし）**：MODEL §3 が再ベースラインを規定（R-U7 同型・理由必須）。moira-core 7.3（[requirements.md:140](../../.kiro/specs/moira-core/requirements.md)）は「スロットは**明示的な理由付き再ベースラインを除き**不変」と再ベースラインを**明示的に許可（carve-out / permission）**し、7.4（[requirements.md:142](../../.kiro/specs/moira-core/requirements.md)）は完了次元の再ベースラインを**拒否**する。ただし 7.3 は「不変の例外として許す」permission であって「再ベースライン時に frozenSlot を上書き**せよ**」という積極的 write **義務ではない**。
  - **未実装は2層**：(1) frozenSlot を上書きする **write は `moira-rebaseline`（仮称・⚠未実装）write skill が所有**（他の ⚠未実装 write スキルと同様、まだ書かれていない）。(2) 加えて現行 engine（fold.ts `n.frozenSlot === null` ガード・[fold.ts:113-118](../../moira/backend/src/fold.ts)）は carve-out を**行使しない**（初回のみ記録し後続 frozenSlot を reason 付きでも無視）ため、skill が reason 付き再ベースラインを emit しても **engine ガードの拡張**（reason 付き＝未完了なら上書き／完了なら I4 拒否）が要る。engine ガードは現状 7.3 と**両立**する（7.3 が許す上限よりさらに immutable なだけで SPEC 違反ではない）。
  - **正直な含意**：本ユニットが記述する受け入れ基準は **現状どの実装でも満たされず**、engine 単独でも満たせない（write skill 実装＋engine 拡張の両方が要る）。これは他の ⚠未実装 write スキル前提のシナリオ（estimate-propose 等が `agreed`）と同種で「シナリオが実装をリードする」標準運用だが、本件は **write skill ＋ engine 拡張の2層**が実装タスクである点を明記する。
  - **確定方針（ユーザー裁定 2026-06-27）**：以上を承知の上で、core 7.3 が**許可**する挙動の受け入れ基準を記述する**目標シナリオとして `agreed` 化**する。実装タスク＝(1) `moira-rebaseline` write skill、(2) fold ガード拡張。前ユニット [schedule-reorder](./schedule-reorder.md) の Phenomenon B 切り出しは本ユニットで確定。moira-model-update の対象ではない（MODEL/spec は正しい）。

- **再ベースラインは Req12 AC2 の「基準不可侵」と矛盾しない（core 7.3 が明示的に carve-out）:** Req12 AC2（[requirements.md:185](../../.kiro/specs/moira-schedule/requirements.md)）が禁じるのは「**予測導出中**に基準を再計算・上書きすること」＝自動 forecast 経路の不可侵。本ユニットの再ベースラインは人間が明示的に発行する理由付きの書き込みで、自動導出ではない。決定的根拠は **moira-core 7.3 が「明示的な理由付き再ベースラインを**除き**不変」と例外を明文で持つ**こと（[requirements.md:140](../../.kiro/specs/moira-core/requirements.md)）——SPEC 自身が「自動導出では不変／人間の理由付き再ベースラインでのみ動く」と両経路を区別している。よって AC2 と本ユニットは両立する（「AC2 違反では？」への先回り反証。doc-fact-checker C7 で確認）。

- **再ベースラインは履歴を消さない（監査性・ガバナンス）:** frozenSlot の current 値は 7/5 になるが、ログには**初回凍結（7/3）**と**再ベースライン（7/5・reason 付き・本ユニット e080）**が**両方残る**（追記専用）。「遅延が消えた」は事実の隠蔽ではなく、「**理由付きで計画を更新した記録が残った**」こと。R-U7 が reason を必須化するのはこのガバナンスのため——再ベースラインで遅延を恣意的に消す濫用は、理由の必須記録と履歴不滅で抑止される。<br><small>※ 初回凍結のイベント id は本ユニット §5 に掲載しない（本ユニットの前提断面で既に凍結済み）。**id は各ユニット内ローカルの例示**ゆえ、他ユニットの同名 id（例：schedule-leveled の e061＝別フィーチャーの別値）と同一視しない。</small>

- **完了サブ単位は再ベースライン不可（I4 施錠）は本ユニットの射程外＝境界として記録のみ:** 完了済み（`implemented`/`accepted`）ノードは予算・スロットが施錠され引き直せない（MODEL §3 I4・moira-core 7.4）。本ユニットの Y は未完了（ready）ゆえ再ベースライン可で、**完了ノードを場に一切持たない**。当初ドラフトはこの否定系を §3 の And と §6 の WHILE に書いていたが、(a) 人間が発案したふるまいではなく AI 追加の境界であること、(b) 本ユニットのどの断面でも実演されないこと（doc-adversary C1/C6）から、**§3/§6 からは外し**、境界として本決定にのみ残す。完了ノードへの再ベースライン拒否を実演する否定系は別ユニット候補。

- **据え置き受容（確認だけ）では標識は解除されない:** R-S7 6.3 は「再ベースラインがスロットを引き直した／予測が再収束した」ときのみ解除。本ユニットは**前者（再ベースライン）**で解除する経路。単に「遅延を確認した（が計画は変えない）」では標識は残り続ける——その「確認だけ」経路は本ユニットの対象外（別ユニット候補）。

- **スコープ＝スロット次元の再ベースラインのみ（予算次元は別）／Z は据え置きで先行標識が残る:** 本ユニットは**スロット（完了予定日）次元**の再ベースラインに限定する。予算（frozenBudget）次元の再ベースライン（上方/下方再見積→再合意＝R-E3・estimate-agreement 機械）は別経路で別ユニット。**Z（予測 7/2 < 基準 7/5 で先行）は本ユニットでは据え置く**ため、Z の先行（ahead）乖離標識は After も残り、プロジェクト全体の陳腐化スロットは Y 解除後も Z の 1 件である（§4）。Z を 7/2 へ引き直すか否かは別判断（ユーザーの明示要望は Y の遅れの正式化に限られる）。
