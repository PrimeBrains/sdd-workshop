---
id: units/requirements-spec-superseded
title: 設計レビュー中に要件の見落としに気づき要件定義まで戻る——確定済み(accepted)の要件行は再オープンせず、「要件定義やり直し」の新ノードが supersede で足される。旧行はクローズのまま累積に残り、現在の達成率はやり直し側で測られる（設計は影響を受ける側だが自動警告は立たない）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: requirements-spec-accepted の後、設計フェーズが進み、AI が設計作業を終えて人間にレビュー依頼を出した状態。要件定義=accepted(EV3)・レビュー作業(要件)=accepted(EV1)・設計=implemented(EV5・レビュー待ち)・設計のレビュー作業=implementing(人間がレビュー中)・タスク/各レビューは pending。玉=人間(設計をレビュー中)
postcondition: 人間が設計レビュー中に要件の見落としに気づき、要件定義まで戻ると判断。確定済みの要件行は再オープンせず、「要件定義やり直し」新ノードが追加され旧・要件定義を supersede。新ノードは人間が見積を合意(agreed)後に implementing(AI が作業中)。旧・要件定義は累積出来高に残るが現在有効集合から外れ、現在進捗(EV%)はやり直し側で測られる(72%→52%・例示)。設計は implemented のまま据え置き(EV5)——supersede は設計を後退させず自動の陳腐化警告も立たない(影響は人間が抱え、(2)の再レビューで初めて P5 信号化)。玉=AI
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 3.2, 3.3, 5.1, 5.3, 5.4, 7.4, 10.1, 10.2, 10.4"
  - "moira-evm: 1.1, 1.2, 2.1, 2.2, 3.3"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3"
  - "moira-surface-schedule: 2.5, 3.4, 8.1, 13.1, 13.2, 13.3, 14.1, 14.2"
---

# 設計レビュー中に要件の見落としに気づき要件定義まで戻る——確定済み(accepted)の要件行は再オープンせず、「要件定義やり直し」の新ノードが supersede で足される。旧行はクローズのまま累積に残り、現在の達成率はやり直し側で測られる（設計は影響を受ける側だが自動警告は立たない）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。スライス未実装は中立に「(スライス未描画)」と記します。

## 1. このユニットで確かめること

`requirements-spec-accepted` の後、設計フェーズが進み AI が設計を仕上げて人間にレビュー依頼を出した。**人間が設計をレビューしている最中に、要件定義の見落とし（欠陥）に気づき、要件定義まで戻ると判断する**と何が起きるか。中核は **「確定済み（accepted）の作業は再オープンせず、新しい『やり直し』ノードを supersede で足す」**こと：

- **確定済みの要件定義の行は再オープンしない**（後退遷移させない）。確定済み（accepted）の完了ノードは後退で再オープンせず supersede で置換する（§2.7・前段の moira-model-update 決定）。
- 代わりに **「要件定義やり直し」の新ノードが追加され、その新ノードが旧・要件定義を supersede（置換）する**（向きは 新→旧）。これは欠陥是正による「既存の完了ノードの変更」＝§2.7(b) に当たり、やり直しノードは旧・要件定義の**兄弟（feature の子）**として立つ（§2.7(a) の root 直下の新 feature は顧客の新規追加要件向けで本件＝欠陥是正とは別。§7 既知 nit）。**旧行はクローズ（accepted）のまま残り、新しい行が足される**——あなたの「行を足す」がこれ。
- **契機は人間の追加・修正要件**：人間が AI に「こう変えたい」と伝え、AI が新ノードを作成・supersede し、**人間がやり直しの見積を合意（agreed）**した上で AI が作業を進める。**新ノードは作業中（implementing）**。
- **出来高の二つの読みが分かれる**：旧・要件定義の出来高（3）は「過去に実際に働いた事実」として**累積出来高には残る**が、**現在有効集合からは外れる**（supersede された）。よって**現在の達成率（EV%）はやり直しノード側で測られ、下がる**（やり直しはまだ未完了＝0）。「働いた事実は消えないが、今の進捗は新しい方で測る」正直な分離（累積は surface-health の責務、現在 EV% は spec-value）。
- **設計は影響を受ける側だが、自動の警告は立たない**：設計は旧・要件定義を前提に作られていたが、設計は完了（implemented）のまま据え置き（EV5 維持）。**supersede は設計を後退させず、「完了ノードが supersede された上流に依存している」ことを自動で警告する導出は MODEL に無い**（前段の moira-model-update で「変更なし」を選択）。よって陳腐化は**木の supersede 辺として見える**が**人間が抱える**もので、導出信号化するのは **(2) で設計を再レビューして後退遷移したとき＝P5 at-risk が初めて立つ**（設計の再作業は別ユニット (2)）。

## 2. 前提（Given）

`requirements-spec-accepted` の後、設計が進み AI が設計を仕上げて人間にレビュー依頼を出した状態。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 9（子の合計） |
| └ 要件定義 | agreed | 3人日 | accepted（確定済み） | 🤖 Claude | 👤 太郎 | 3 |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | accepted | 👤 太郎 | — | 1 |
| └ 設計 | agreed | 5人日 | implemented（レビュー待ち） | 🤖 Claude | 👤 太郎 | 5 |
| └ レビュー作業（設計） | agreed | 1人日（例示） | implementing（太郎がレビュー中） | 👤 太郎 | — | 0 |
| └ タスク | agreed | 2人日 | pending | — | — | 0 |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending | — | — | 0 |

- 出来高 EV%（達成率）：**72%**（EV_abs 9〔要件3＋レビュー要件1＋設計5〕 ÷ 合意済み有効葉の見積合計 12.5）
- 累積出来高（EV_abs・supersede 含む基底）：**9**（現時点では現在有効集合と一致）
- 実行カバレッジ（R-S8）：**17%**（`implementing` の合意済み有効葉 1〔設計のレビュー作業〕 / 6）
- 人間レビュー待ちキュー：**1 件**（設計＝implemented・レビュー担当 太郎）
- 玉（次の手番）：人間（太郎が設計をレビュー中）

## 3. ふるまい（When / Then）

```
When  AI が設計作業を終えて人間にレビューを依頼し、人間が設計をレビューしている最中に、
      要件定義に見落とし（欠陥）があったことに気づき、要件定義まで戻ると判断する。
Then  既に 100% 完了しクローズ（承認済み・accepted）された要件定義の行は再オープンしない。
And   代わりに「要件定義やり直し」の新しいノードが追加され、その新ノードが旧・要件定義を
      スーパーシード（置換）する（旧行はクローズのまま残り、新しい行が足される）。
And   人間が AI に「こう変えたい」と追加・修正の要件を伝えることが契機となって、
      AI がこの新ノードを作成し、スーパーシードする。
And   新ノードは「作業中（オープン＝implementing）」の状態で、AI がやり直しの要件定義を進める。
And   旧・要件定義の出来高は「過去の事実」として累積には残るが、現在の達成率（EV%）は
      supersede された旧を除き、やり直しノード側で測られる（旧の出来高は現在進捗から抜ける）。
And   設計は旧・要件定義を前提に作られていたため、やり直しの影響を受ける側（陳腐化）として扱う。
```

<small>注：「やり直し」新ノードは feature の子として旧・要件定義の兄弟に立ち、`新ノード →(supersede)→ 旧ノード` の置換辺（`relate` イベント・`edgeKind: supersede`・`from`=新/`to`=旧）を張る（MODEL §2.7(b) 既存完了ノードの変更）。旧ノードは accepted のまま不変（append-only）・その EV_abs は累積基底に残る（§2.7）。現在有効集合は supersede された旧を除外する（R-S5・`effective-set.ts`）。やり直しノードの見積は decompose で proposed として置かれ、**人間が estimate-agreement 遷移で agreed**（I6/合意は人間限定）にしてから AI が implementing に進める。**設計の陳腐化は「自動で立つ導出信号ではない」**——supersede は設計を後退させず、「完了ノードが supersede 上流に依存」を警告する導出は MODEL に無い（前段 moira-model-update で変更なしを選択）。陳腐化は木の supersede 辺として可視だが人間が抱え、信号化は (2) の再レビュー→後退遷移（P5 at-risk）で初めて起きる。なお `accepted` の後退禁止＝supersede は確定（accepted）に対する規律で、`implemented`（未確定）の差し戻し（returned で確定済）とは別——R-D7 の "completed" 射程（accepted 限定か）は MODEL 用語の既知 nit（§7）。書き込み（ノード作成・supersede・合意・遷移の emit）の実体は未実装スキル（`moira-progress` 仮称・⚠）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（木・状態・出来高 EV%・累積・陳腐化）＋ schedule-time（玉＝キュー移動）**。2断面：**Before**（設計レビュー待ち）→ **After**（要件やり直しノードが supersede で追加・AI 作業中）。

### 4-1. spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value（Before — 設計レビュー待ち）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV% <b>72%</b>（9/12.5）・累積 <b>9</b>・実行 17%</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">3</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>5</b></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">レビュー中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク〜レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="3"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#7c2d12;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value（After — 「要件定義やり直し」ノードが supersede で追加・AI 作業中）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現在 EV% <b style="color:#dc2626">52%</b>（72%→52%・6/11.5）<br><span style="color:#64748b;font-size:11px">（累積出来高 9 は不変＝surface-health の責務。spec-value は現在 EV% を host）</span><br><span style="color:#b45309;font-size:11px">⚑ やり直しで旧要件が現在進捗から外れた（働いた事実は累積に残る）</span></td>
  </tr>
  <tr style="background:#fafafa;color:#94a3b8">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><s>└ 要件定義（旧）</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><s>agreed 3</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e5e7eb;border-radius:4px;padding:1px 6px">置換済み</span> <span style="color:#94a3b8">(accepted・superseded)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">累積のみ 3<br><span style="font-size:11px">現在進捗から除外</span></td>
  </tr>
  <tr style="background:#fff7ed">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義やり直し（新）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">作業中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#b45309;font-size:11px">◀ 新規・supersede→旧要件・玉=AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>0</b>（作業中＝未完了）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件・旧）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1（旧要件のみが supersede され、その兄弟のレビュー作業ノードは現在有効集合に残る）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（影響を受ける側・自動警告なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span><br><span style="color:#64748b;font-size:11px">◀ 据え置き（後退しない）。supersede 上流依存を自動警告する導出は無い＝陳腐化は人間が抱える（(2) で P5 信号化）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">5（implemented のまま・EV 維持）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）〜タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="3"><span style="color:#94a3b8">（レビュー作業(設計)=実質中断・タスク群=pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0</td>
  </tr>
</table>

<small>※ **現在 EV% 72%→52% と累積 9 不変の両立**：旧・要件定義（出来高3）は supersede で**現在有効集合から外れる**（`effective-set.ts`：新→旧の supersede 辺で旧を除外）→ 現在進捗の分子から 3 が抜け、分母も旧3が抜けやり直し2が入る（12.5→11.5）。現在 EV% = 6/11.5 ≈ **52%**。一方**累積出来高は 9 のまま**（`computeCumulativeEvAbs` は supersede 済みも数える＝働いた事実は消えない）。「今どこまで進んでいるか（現在進捗）」と「これまでどれだけ働いたか（累積）」を正直に分離（MODEL §2.7・R-S5）。やり直しの 2人日が完了すれば現在 EV% が上がる（別ユニット）。</small>

### 4-2. schedule-time 画面 — 玉の動き

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（設計レビュー待ち）— 玉＝人間（太郎が設計をレビュー中）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計（implemented）<span style="color:#b45309"> ◀ 太郎がレビュー中</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（やり直しノード追加・AI 作業中）— 玉＝AI（Claude がやり直し要件を作業）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義やり直し</b>（implementing）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計（implemented・queues.ts の導出で在席し続ける）<span style="color:#64748b"> ◀ 太郎は要件やり直しへ注力（設計レビューは継続中）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
  </tr>
</table>

<small>※ やり直しノードが implementing・assignee=Claude で agentWorkQueue に入る（玉＝AI）。設計は implemented のまま humanReviewQueue に**残る**（queues.ts は actor 非依存で implemented 葉を入れる）——「玉」は俗称で、この After では agentWorkQueue（やり直し）と humanReviewQueue（設計）の**両方**に在る。設計は**差し戻さない・後退しない**（人間が見つけたのは要件の問題で設計の品質否認ではない）。設計が旧要件前提で陳腐化していることを**自動で警告する導出は無く**（moira-model-update で変更なし）、信号化は (2) の再レビュー→後退遷移で初めて起きる。</small>

### 4-3. 素のデータ（After）

| ノード | lifecycle | 見積 | 現在有効集合 | 現在 EV_abs 寄与 | 累積 EV_abs 寄与 |
|---|---|---|---|---|---|
| 要件定義（旧） | accepted・**superseded** | 3 | ❌ 除外（supersede） | 0 | ✅ 3（働いた事実） |
| 要件定義やり直し（新） | implementing | 2（例示・人間が agreed） | ✅ | 0（未完了） | 0 |
| レビュー作業（要件・旧） | accepted | 1 | ✅（旧要件のみ supersede・兄弟は残る） | 1 | 1 |
| 設計 | implemented（影響下・自動警告なし） | 5 | ✅ | 5 | 5 |
| レビュー作業（設計） | implementing | 1 | ✅ | 0 | 0 |
| タスク / レビュー作業（タスク） | pending | 2 / 0.5 | ✅ | 0 | 0 |

現在 EV%：**52%**（現在 EV_abs 6〔やり直し0＋レビュー要件1＋設計5〕 / 現在有効集合の合意済み見積 11.5〔やり直し2＋レビュー要件1＋設計5＋レビュー設計1＋タスク2＋レビュータスク0.5〕）<br>
累積 EV_abs：**9**（supersede 済みの旧要件 3 を含む。働いた事実は消えない。※累積は surface-health の責務）<br>
実行カバレッジ：**33%**（`implementing` 2〔やり直し・設計レビュー作業〕 / 6）<br>

<small>※ 例示見積（やり直し 2人日・各レビュー作業 1/0.5人日）は確定値でない。やり直しは**人間の estimate-agreement で agreed** にしてから着手する前提（agreed でなければ分母から外れ EV% は 63% 側に振れる——本ユニットは agreed 即合意を採る）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① やり直しノード作成 `decompose`（親 F に子「要件定義やり直し」＋見積を proposed で追加・理由必須）、② supersede `relate`（`op:add`・`edgeKind:supersede`・`from`=やり直し/`to`=旧要件）、③ やり直し見積の合意 `transition`（`machine:estimate-agreement`・`to:agreed`・actor=**人間**＝合意は人間限定 I6）、④ やり直し着手 `transition`（`machine:lifecycle`・`to:implementing`・assignee Claude）。**いずれも emit 機構は未実装（`moira-progress` 仮称・⚠）** |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-superseded.md`） | 太郎が設計レビュー中に要件見落としを発見した経緯、「こう変えたい」の追加要件、再オープンせず supersede する判断 |
| **spec-value 画面 / schedule-time 画面** | 旧要件が「置換済み」、「要件定義やり直し」行の追加、現在 EV% 72%→52%（累積 9 不変は surface-health）、設計は据え置き（自動警告なし）、玉が太郎→AI（§4） |

```json
[
  {
    "id": "e100", "ts": 100,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "設計レビューで判明した要件の見落としを是正するため、やり直しノードを追加（人間の追加要件が契機）",
    "children": [ { "node": "F/req-redo", "estimate": 2 } ]
  },
  {
    "id": "e101", "ts": 101,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate",
    "op": "add",
    "edgeKind": "supersede",
    "from": "F/req-redo",
    "to": "F/req",
    "reason": "要件定義やり直しが旧・要件定義を置換（accepted の旧は再オープンせず supersede）"
  },
  {
    "id": "e102", "ts": 102,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req-redo",
    "machine": "estimate-agreement",
    "to": "agreed",
    "reason": "やり直し要件の見積を人間が合意（合意は人間限定・I6）"
  },
  {
    "id": "e103", "ts": 103,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "transition",
    "node": "F/req-redo",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "やり直し要件の作業に着手"
  }
]
```

<small>注：ノード ID・ts・見積値は例示。relate のフィールドは `types.ts` の `RelateEvent`（`op`・`from`・`to`・`edgeKind`）に一致（supersede は `from`=新/`to`=旧＝`effective-set.ts`）。**e100** がやり直しノードを生み（decompose＝見積は proposed・理由必須 §2.8）、**e101** が supersede 辺を張り旧要件が現在有効集合から外れる（R-S5）。**e102** で**人間が**見積を agreed にする（合意は人間限定 I6——AI は自分の見積を合意できない）。**e103** でやり直しが implementing。**設計の依存張替イベントは置かない**——再張替しても「完了ノードが supersede 上流に依存」を警告する導出は無く（moira-model-update 変更なし）、設計は implemented・EV5 据え置き。陳腐化の信号化は (2) の後退遷移＝P5 at-risk で初めて起きる。supersede は decompose/transition と独立の `relate` 辺種別（§2.8）。emit 機構は未実装（`moira-progress` 仮称・⚠）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 人間が設計レビュー中に要件の見落としに気づき要件定義まで戻ると判断したとき、**システムは** 確定済み（承認済み＝accepted）の要件定義の行を「作業中」へ巻き戻して再オープン**してはならない**（確定済みの作業は巻き戻さず、置き換えで対応する）。
- **WHEN** 要件定義のやり直しが起きたとき、**システムは** 新しい「要件定義やり直し」の行を追加し、その新しい行が旧・要件定義を置き換える（supersede する）関係を記録し**なければならない**。
- **WHEN** やり直しの行が作られたとき、**システムは** 旧・要件定義の行を「承認済み（クローズ）」のまま保持し、その出来高を**これまでの累積の出来高**には残さ**なければならない**（働いた事実は消えない）。
- **WHEN** 旧・要件定義が置き換えられたとき、**システムは** 旧の行を**今の進捗の集計（現在の達成率＝EV%）から外し**、達成率を残りの今有効な行（やり直しを含む）で測ら**なければならない**（今の進捗から旧の出来高を除く）。
- **IF** やり直しの行の見積が人間に合意（agreed）されたなら、**WHEN** やり直しが作業中（implementing）になったとき、**システムは** その出来高を増やし**てはならない**（作業中は未完了＝出来高は完了時に獲得）。玉（次の手番）はエージェント（AI）側に現す。
- **WHEN** 要件定義が置き換えられても、**システムは** 旧・要件定義に依存して作られた設計の行を自動で「やり直し対象」と警告**してはならない**（設計は完了＝implemented のまま据え置き・出来高も維持。設計が作り直しを要するかは後の再レビューで人間が判断する＝別ユニット (2)）。
- **WHEN** 人間が追加・修正の要件を AI に伝えたとき、**システムは** それを契機としてやり直しの行の作成と置き換え（supersede）を行わ**なければならない**。
- 注：本ユニットはコスト（AC）・コスト効率（CPI）・予定価値（PV）・スケジュール（SPI）の変化は対象外（別軸）。supersede は凍結ベースライン（PV）を動かさない（MODEL §3）点は §7 で触れるに留める。

## 7. 決定事項

- **確定済み（accepted）の手戻りは再オープンせず supersede。** やり直しは §2.7(b)（既存完了ノードの変更）に当たり、旧・要件定義の**兄弟（feature の子）**として立て `新→supersede→旧`（relate・`op:add`・`edgeKind:supersede`・`from`=新/`to`=旧）。旧は accepted のまま不変（append-only）。
- **出来高の二読みを分離。** 旧の EV_abs（3）は累積出来高に残る（`computeCumulativeEvAbs` は supersede 済みを数える）が、現在有効集合（R-S5・`effective-set.ts`）からは外れ、現在の達成率（EV%）はやり直し側で測る（72%→52%）。**累積は surface-health の責務・現在 EV% は spec-value が host**（spec-value に累積を描かない）。
- **やり直しの見積は人間が合意（agreed）してから着手。** decompose は proposed を置き、人間の estimate-agreement 遷移で agreed（合意は人間限定 I6）。AI は自分の見積を合意できない。
- **【D1】設計の陳腐化は自動の導出信号にしない。** supersede 上流に依存する完了ノードを自動で at-risk 警告する導出は MODEL に無い（前段 moira-model-update で「変更なし」を選択）。設計は implemented・EV5 据え置きで、陳腐化は木の supersede 辺として可視だが人間が抱える。信号化は続編 (2) で設計を再レビュー→後退遷移したとき＝P5 at-risk が初めて立つ。
- **【既知 nit / D2】§2.7 の supersede 新ノードの配置。** §2.7 は (a) 追加要件＝root 直下の新 feature／(b) 既存完了ノードの変更＝新ノード+supersede を分けるが、(b) の新ノードの配置（兄弟か root か）を明示しない。本ユニットは「欠陥是正＝§2.7(b)・やり直しは旧の兄弟」を採る（顧客の新規追加要件なら §2.7(a) の root 新 feature で別）。MODEL 用語の既知 nit。
- **【既知 nit / D3】R-D7「completed ノードの後退禁止」の射程。** `ev.ts` の `COMPLETED={implemented,accepted}` は字面上 implemented も含むが、後退禁止＝supersede の規律は **accepted（確定）** に対するものと読む。`implemented`（未確定）の差し戻しは returned/re-returned で確定済の正規後退（P5）。R-D7 の "completed" 定義が未確定なのは MODEL 用語の既知 nit。
- **対象外（別軸）。** AC/CPI/PV/SPI は本ユニットで扱わない。supersede は凍結ベースライン（PV）を動かさない（MODEL §3）。

検証：doc-adversary×3（G1–G4＋SC1–SC7）→ 著者パッチ → doc-gate-judge **PASS**（生存 Critical/Important = 0・一次資料を types.ts/ev.ts/effective-set.ts/queues.ts/MODEL/requirements で現物照合・SOURCE_SET_CONFIRMED）。
