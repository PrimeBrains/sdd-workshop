---
id: units/schedule-reorder
title: 作業を組み替えると予測完了日がずれ、凍結ベースラインとの差が遅延として現れる
status: agreed
language: ja
actor: 開発者
surfaces: [schedule-time]
precondition: Y/要件定義・Z/要件定義がともに合意済み・太郎に割当済み・スケジュール載り済み（Y→Z の順で凍結スロット確定）
postcondition: Z を Y より先に行うよう組み替えられ、生きた予測だけが動いて Y の予測が基準完了日を追い越し、凍結ベースラインは不変のまま遅延が可視化される
touches_specs:
  - moira-schedule
  - moira-core
  - moira-surface-schedule
touches_requirements:
  - "moira-schedule: 1.1, 1.2, 6.1, 6.2, 6.3, 12.1, 12.2"
  - "moira-core: 3.3, 7.3, 9.1, 9.3"
  - "moira-surface-schedule: 2.2, 6.1, 15.2"
---

# 作業を組み替えると予測完了日がずれ、凍結ベースラインとの差が遅延として現れる

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

一度スケジュールに載って予定完了日（ベースライン）が**凍結**された後でも、「やっぱり Z を Y より先にやりたい」と**順序を組み替えられる**こと（凍結は組み替えを禁じない）。組み替えると **生きた予測** だけが動き、**凍結ベースラインは動かない**こと。その結果、Y の予測完了日が基準完了日を追い越すと「予測が基準に遅延」と警告が出て、開発者が**まだ着手していない計画段階で**「このままだと当初計画より遅れる」と気づけること。

## 2. 前提（Given）

太郎に2件の要件定義作業（別フィーチャー Y・Z）が合意済み・割当済みで、既に **Y → Z の順** でスケジュールに載っている。Y の方が大きい（3人日 > 2人日）ため平準化は Y を先に置き、各々の予定完了日が凍結済み。今はまだどちらも着手前。

| ノード | 見積状態 | 見積値 | 担当 | lifecycle | 基準完了日（凍結スロット） | 予測完了日（生きた予測） |
|---|---|---|---|---|---|---|
| Y/要件定義 | agreed | 3人日 | 太郎 | ready | 2026-07-03 | 2026-07-03（計画通り） |
| Z/要件定義 | agreed | 2人日 | 太郎 | ready | 2026-07-05 | 2026-07-05（計画通り） |

太郎の日次容量：1.0人日/日（既定）。今日は 2026-07-01。両者とも **予測＝基準**（計画通り・遅延なし）。
依存辺：なし（平準化は Y=CP3 > Z=CP2 の優先で Y を先に置いている）。

## 3. ふるまい（When / Then）

```
When  既に Y → Z の順でスケジュール済みだが、開発者が「Z の方が急ぎなので Y より先にやりたい」
      と判断し、Z を Y より先に行うよう順序を組み替える。
Then  システムは凍結ベースライン（基準完了日）を勝手に書き換えず、生きた予測スケジュールだけを引き直す。
And   Z の予測完了日は前倒しになり、Y の予測完了日は後ろへずれる。
And   Y の基準完了日（ベースライン）は元の 7/3 のまま動かない（凍結は順序変更で消えない）。
And   Y は「予測が基準より遅れている」と画面に警告が出て、開発者は着手前の計画段階で
      「このままだと当初計画より遅れる」と気づける。
```

> 後続への橋渡し（本ユニットの検証対象外）：この遅れを正式に計画へ織り込み直したい場合は、別途「理由付き再ベースライン」で基準完了日そのものを引き直せる（任意・人間の判断）。それは別ユニット [schedule-rebaseline](./schedule-rebaseline.md) が扱う。

<small>注：「組み替え」は依存辺（`relate`／dependency）Z→Y の追加で表現する——Moira に手動の優先度フィールドは無く、順序は平準化（leveler）の (1)依存（トポロジカル）→(2)クリティカルパス長→(3)nodeId昇順 で決まるため、人間が任意順序を指定する手段は依存辺である（§7 #3）。「予測だけ動き基準は不変」は MODEL §3（凍結ベースライン PV/SPI と生きた予測 P7/P8 の分離・[MODEL.md:218](../../moira/MODEL.md)）。「予測が基準に遅延」は R-S7 スロット陳腐化（moira-schedule Req6）で、参照実装では Inspector の `forecastBehind`＝`予測 > 基準` 判定→警告ピル（[Inspector.tsx:61-62,167](../../moira/frontend/src/surfaces/schedule/Inspector.tsx)）。組み替えの write を担うスキル（リスケ系・⚠未実装）は本ユニットの対象外。</small>

## 4. 画面の変化（Before → After）

採用表現は **schedule-time のガントチャート＋作業詳細（Inspector）** 中心。

### schedule-time ガントチャート

採用表現は実装 `ScheduleGantt.tsx` に接地：各葉が1行で **破線＝凍結PMB帯（基準完了日）／実線＝生きた予測（EAC）バー** を重ね描きし、乖離を **橙＝遅れ（予測>凍結）／緑＝先行（予測<凍結）** で色分けする（凡例 line 298-306）。組み替えで**破線帯は動かず**、実線バーだけが動いて両者がずれる＝それが遅延/前倒し。計画通り（基準＝予測）の行は帯とバーが重なるので1段で、乖離した行は基準┄（凍結帯）と予測█（生きたバー）を上下2段に分けて示す。縦 ┊ は asOf（7/1）。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12.5px;width:100%">
  <tr style="background:#374151;color:#fff">
    <td style="padding:6px 8px;width:210px">📅 schedule-time（Before — Y→Z・計画通り）</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/1┊</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/2</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/3</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/4</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/5</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/6</td>
  </tr>
  <tr>
    <td style="padding:6px 8px;border:1px solid #cbd5e1">Y/要件定義 <span style="background:#dbeafe;border-radius:4px;padding:1px 5px">👤太郎</span><br><span style="font-size:10px;color:#64748b">基準┄／予測█（一致）</span></td>
    <td colspan="3" style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center"><span style="background:#3b82f6;color:#fff;border:1px dashed #1e3a8a;border-radius:4px;padding:2px 8px;font-size:10.5px">基準┄=予測█ 3人日</span></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:6px 8px;border:1px solid #cbd5e1">Z/要件定義 <span style="background:#dbeafe;border-radius:4px;padding:1px 5px">👤太郎</span><br><span style="font-size:10px;color:#64748b">基準┄／予測█（一致）</span></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td colspan="2" style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center"><span style="background:#8b5cf6;color:#fff;border:1px dashed #4c1d95;border-radius:4px;padding:2px 8px;font-size:10.5px">基準┄=予測█ 2人日</span></td>
    <td style="padding:6px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:12.5px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff">
    <td style="padding:6px 8px;width:210px">📅 schedule-time（After — Z→Y へ組み替え）</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/1┊</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/2</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/3</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/4</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/5</td>
    <td style="padding:6px 8px;text-align:center;width:50px">7/6</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 👤太郎 — 基準┄（凍結7/3・不変）</td>
    <td colspan="3" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #1e3a8a;color:#1e3a8a">┄ 基準 凍結7/3 ┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Y/要件定義 — 予測█（生きた7/5・遅れ橙）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td colspan="3" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#d97706;color:#fff">予測█ →7/5（基準を2日超過＝遅れ）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Z/要件定義 👤太郎 — 基準┄（凍結7/5・不変）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td colspan="2" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;border-bottom:2px dashed #4c1d95;color:#4c1d95">┄ 基準 凍結7/5 ┄</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #cbd5e1">Z/要件定義 — 予測█（生きた7/2・先行緑）</td>
    <td colspan="2" style="padding:4px 8px;border:1px solid #cbd5e1;text-align:center;background:#16a34a;color:#fff">予測█ →7/2（基準より3日早い＝先行）</td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
    <td style="padding:4px 8px;border:1px solid #cbd5e1;background:#f1f5f9"></td>
  </tr>
</table>

<small>※ **破線帯（基準＝凍結PMB）は Before/After で同じ位置のまま**（Y は 7/3、Z は 7/5）。動いたのは実線バー（生きた予測）だけ。After では Y の予測バーが基準帯（7/3）を **2日分超過**（橙＝遅れ＝R-S7 behind）、Z は逆に基準帯（7/5）より **3日前倒し**（緑＝先行＝R-S7 ahead）。担当は実装ではラベル列のアバターで示し、バー内に文字ラベルは焼かない（ここでは図示の都合で日数を併記）。正確な乖離値は下記 Inspector に出る。</small>

### 作業詳細（Inspector）— Y/要件定義をクリック

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:380px;margin-top:6px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 Inspector — Y/要件定義（Before — 計画通り）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b;width:200px">基準完了日（ベースライン）</td><td style="padding:4px 10px;border:1px solid #cbd5e1">2026-07-03</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">予測完了日（生きた予測）</td><td style="padding:4px 10px;border:1px solid #cbd5e1">2026-07-03</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">遅延標識</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#16a34a">なし（予測＝基準）</td></tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:380px;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="2" style="padding:6px 10px">🔍 Inspector — Y/要件定義（After — 組み替え後）</td></tr>
  <tr>
    <td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b;width:200px">PV 計画価値 (MD)</td>
    <td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">0（基準 7/3 が今日 7/1 より後 → 未だ PV 未算入）</td>
  </tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">EV 出来高 (MD)</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">0（未完了）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">SV 差異 (= EV − PV)</td><td style="padding:4px 10px;border:1px solid #cbd5e1">0（PV 未算入のため・§7 #4）</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">BAC 予算・確定 (MD)</td><td style="padding:4px 10px;border:1px solid #cbd5e1">3</td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">基準完了日（ベースライン）</td><td style="padding:4px 10px;border:1px solid #cbd5e1"><b>2026-07-03（不変）</b></td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">予測完了日（生きた予測）</td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#dc2626"><b>2026-07-05</b></td></tr>
  <tr><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#64748b">遅延標識</td><td style="padding:4px 10px;border:1px solid #cbd5e1"><span style="background:#fde68a;border-radius:4px;padding:1px 6px;color:#92400e">予測 2026-07-05 が基準 2026-07-03 に遅延（R-S7）</span></td></tr>
</table>

**データ（素の値）**

| | ノード | lifecycle | 担当 | 見積値 | 基準完了日（frozenSlot） | 予測完了日（predicted） | 乖離（R-S7） |
|---|---|---|---|---|---|---|---|
| Before | Y/要件定義 | ready | 太郎 | 3人日 | 2026-07-03 | 2026-07-03 | なし（計画通り） |
| Before | Z/要件定義 | ready | 太郎 | 2人日 | 2026-07-05 | 2026-07-05 | なし（計画通り） |
| After | Y/要件定義 | ready | 太郎 | 3人日 | **2026-07-03（不変）** | 2026-07-05 | **+2日 遅延**（予測>基準） |
| After | Z/要件定義 | ready | 太郎 | 2人日 | **2026-07-05（不変）** | 2026-07-02 | −3日 前倒し（予測<基準） |

陳腐化スロット数（R-S7）：Before 0 → After **2**（Y=遅れ・Z=先行。いずれも「予測が基準スロットと乖離」）。R-S7 は **cause-agnostic**（原因不問で乖離を検出＝DECISIONS.md:55）ゆえ、今回の**依存辺の追加**起因の乖離も当然に検出・計上される（§7 #2）。なお Inspector の遅延ピルは behind（予測>基準）側のみ点くため、Z の**先行（ahead）はガントの緑で**表れる（Inspector のピルには出ない＝設計上 behind がリスク信号）。
凍結スロット：**1件も書き換わっていない**（Y=7/3・Z=7/5 のまま）。動いたのは生きた予測のみ。

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | relate イベントが **1 件** 追記される（下記 JSON）。frozenSlot を書く transition は**発行されない** |
| **会話ログ**（`.kiro/conversations/{日付}-schedule-reorder.md`） | 組み替え判断（Z を急ぐ理由）の記録 |
| **schedule-time 画面** | ガントの実線バー（生きた予測）が Z→Y 順に入れ替わり、Y の予測バーが基準帯（破線 7/3）を追い越して遅れ（橙）表示、Z は基準帯（7/5）より先行（緑）表示（§4） |

```json
[
  {
    "id": "e070", "ts": 70,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "relate",
    "op": "add",
    "edgeKind": "dependency",
    "from": "Z/req",
    "to": "Y/req",
    "policy": "accepted"
  }
]
```

<small>注：`from: "Z/req"`（先行）→ `to: "Y/req"`（後続）で「Y は Z を待つ」＝ Z を先に行う順序を表す（`RelateEvent` の from=predecessor/to=successor は [types.ts:71-72](../../moira/backend/src/types.ts)）。この追記で derive() が再実行され（R-S2）平準化が Z→Y 順に引き直す。**frozenSlot 属性を持つ transition は一切発行しない**——順序組み替えは生きた予測（P7/P8）だけを動かし、凍結ベースラインには触れない（fold.ts は frozenSlot を初回のみ記録し以後不変・[fold.ts:116](../../moira/backend/src/fold.ts)）。新しいイベント種別・可変状態は増やさない（4イベントの範囲内＝moira-core 1.3／relate スキーマは 3.3）。`relate add` は循環があれば fold が拒否するが（moira-core 9.1）、本ユニットの前提は依存辺ゼロゆえ循環は起きない。ノード ID・ts 値はユニット内ローカルの例示（他ユニットの同名 ID と同一実体を指さない）。組み替えを取り消すには同じ辺の `op:"remove"` を追記すれば予測は元へ再収束し、遅れ標識は解除される（再収束による解除＝moira-schedule 6.3）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 開発者が作業の順序を組み替えたとき、**システムは** 凍結ベースライン（基準完了日）を書き換えず、生きた予測スケジュールのみを再導出**しなければならない**。
- **WHEN** 順序変更で或る作業の予測完了日が基準完了日より後になったとき、**システムは** それを「予測が基準より遅れている」状態として可視ギャップに提示**しなければならない**。
- **WHILE** 順序変更が記録されている間、**システムは** 凍結ベースラインを不変に保た**なければならない**（基準そのものの引き直しは理由付き再ベースラインという別操作）。
- **WHEN** 作業の順序を組み替えるとき、**システムは** 新しい記録の種類を増やさず、既存の「依存関係（先にどれをやるかの順序制約）の追加」として記録**しなければならない**。
- **WHEN** 予測が基準へ再び一致した、または理由付き再ベースラインが基準を引き直したとき**にのみ**、**システムは** 遅れの標識を解除**しなければならない**。単に「遅れを確認しただけ（計画は変えない）」では解除**してはならない**。

<small>注（記号対応・本文からは外して平文に保つ＝非専門家が §1〜§4・§6 でチェックできるように）：上の「遅れている」標識は R-S7 スロット陳腐化（cause-agnostic）、その解除条件は R-S7 6.3、「予測を再利用し新たな予測アルゴリズムを導入しない」は R-S7 6.2、「依存関係の追加」は 4 イベントの `relate`（moira-core 3.3）、凍結ベースライン不可侵は moira-schedule 12.2 に対応する。</small>

## 7. 決定事項

<!-- 検証ループ前のドラフト。対話で確定した決定＋grounding で出た開放論点をここに記す。 -->

- **本ユニット = 組み替え→予測ずれ→遅延可視（Phenomenon A・実装済）。「基準スロット自体の引き直し」（Phenomenon B）は別扱い:** 本ユニットが描くのは「順序を組み替えると**生きた予測だけ**が動き、**凍結ベースラインは不変**のまま、差が R-S7 遅延として見える」経路で、これは参照実装で動く（leveler 再導出＋Inspector `forecastBehind`/R-S7 ピル）。これに対し**基準完了日そのものを引き直す「理由付き再ベースライン」（Phenomenon B）は core 7.3 が SPEC として許可（carve-out）するが、その write は `moira-rebaseline`（⚠未実装）skill 所有・現行 engine の fold ガード拡張も要る**（fold.ts は `n.frozenSlot === null` ガードで初回スロットを不変に保ち後続の frozenSlot を無視・[fold.ts:113-118](../../moira/backend/src/fold.ts)。MODEL/spec 側に欠陥は無い）。**Phenomenon B は別ユニット [schedule-rebaseline](./schedule-rebaseline.md) として切り出すことでユーザー裁定済み**（正確な切り分けは当該ユニット §7 #1。本ユニット §3 末尾は「任意で引き直せる」と触れて後続ユニットへ橋渡しするに留め、主たる Then には含めない）。

- **R-S7 は cause-agnostic で依存辺起因の陳腐化も検出対象（当初の「MODEL ギャップ」懸念は検証で解消）:** 検証ループで R-S7 が DECISIONS.md:55 で **cause-agnostic 化**済みと確認した（陳腐化トリガーを「割当変更」から「生きた予測の完了が凍結スロットと乖離（原因＝割当/c のいずれでも）」へ一般化）。よって**依存辺（relate）の追加による乖離も R-S7 の検出対象に当然入っている**——本ユニットの「Y のスロットが陳腐化＝遅れ」は正典に完全に裏付けられ、検出に穴は無い。MODEL R-S7（[MODEL.md:326-327](../../moira/MODEL.md)）／moira-schedule 6.1（[requirements.md:99](../../.kiro/specs/moira-schedule/requirements.md)）が原因例として挙げる「割当変更・容量 c 変更」は "regardless of cause" の後の**例示**であって網羅列挙ではない。**残る論点は最小**：requirements.md 6.1 の「原因別提示」の例に「依存辺変更」を明示追加すれば親切（Suggestion レベルの spec 文言整備）。**MODEL 正典側に欠陥は無く moira-model-update は不要**——当初ドラフトの「ESCALATE 候補」評価は過大だったので撤回する（検証ループの doc-fact-checker C3 で確定）。

- **Moira に手動の優先度フィールドは無い — 「Z を Y より先に」は依存辺で表現する:** 平準化（leveler）の順序は (1)依存（トポロジカル）→(2)クリティカルパス長→(3)nodeId昇順 で決まり（[leveler.ts:99-112](../../moira/backend/src/leveler.ts)）、人間が任意順序を上書きする専用フィールドは存在しない。ゆえに「Z を先に」は依存辺 Z→Y（`relate`/dependency）で表し、leveler が earliest-start（先行の予測完了+1日）で順序を守る。この依存辺による表現は忠実かつ機能的で、本ユニットの検証を妨げない。**純粋な優先度（真の技術的依存ではない単なる順序希望）に独自プリミティブを要するか**は将来の設計論点（FYI）として残すに留め、本ユニットでは ESCALATE しない（現行プリミティブで成立するため）。

- **asOf=7/1（着手前の計画時点）では SV=0 のまま — 遅延は SV でなく R-S7 予測乖離で出る:** 凍結スロット（Y=7/3・Z=7/5）はいずれも asOf（7/1）より後なので PV 未算入（`scheduledByNow=false`）、よって SV=EV−PV=0（[Inspector.tsx:52,55](../../moira/frontend/src/surfaces/schedule/Inspector.tsx)）。遅延は「予測 > 基準」の `forecastBehind`（R-S7）として**前向きに**現れる。これは「計画段階では PV はまだ立たないが、予測の基準超過は即座に警告できる」という早期警戒の正直な姿であり、本ユニットの主たる検証点。

- **カレンダーの穴（c=0日＝週末・休暇）は簡略化:** 本ユニットの日付は容量 1.0人日/日（週末を無視）の例示。c=0 日が暦の穴としてスケジュール gap になる挙動は別途（姉妹ユニット [schedule-leveled](./schedule-leveled.md) と同じ簡略化方針——両ユニットに同趣旨の注記を揃える）。
