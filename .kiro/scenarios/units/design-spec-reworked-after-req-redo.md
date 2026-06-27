---
id: units/design-spec-reworked-after-req-redo
title: 要件やり直しが承認された後に設計を再レビューすると新要件に合っておらず、設計を後退遷移で差し戻して作り直す——陳腐化で温存していた設計の出来高（5）が、作り直し確定で現在からも累積からも正直に落ちる（accepted は supersede／implemented は後退遷移、の対比）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: requirements-spec-superseded の後、「要件定義やり直し」が implementing→implemented→レビュー→accepted まで完了し、設計の依存先がやり直し（現在 accepted）に張り替わった状態。設計は implemented（レビュー待ち・EV5・旧要件前提で陳腐化していたが上流は完成済み）。人間が新要件に照らして設計を再レビューしようとしている。玉=人間
postcondition: 人間が新要件に照らして設計を再レビューし、設計が新要件に合っていないと判断。設計は accepted でない（implemented）ので supersede ではなく後退遷移（implemented→implementing）で差し戻し。設計のレビュー作業は完了（+1）、設計本体は EV 5→0（現在からも累積からも脱落＝supersede と異なる）。玉=AI が新要件で設計を作り直す。現在 EV% ≈70%→≈35%（例示）
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 3.1, 5.1, 5.3, 5.4, 5.6, 6.1, 6.2, 7.4"
  - "moira-evm: 1.1, 1.2, 2.1, 2.2, 5.1"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 3.4, 8.1, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 要件やり直しが承認された後に設計を再レビューすると新要件に合っておらず、設計を後退遷移で差し戻して作り直す——陳腐化で温存していた設計の出来高（5）が、作り直し確定で現在からも累積からも正直に落ちる（accepted は supersede／implemented は後退遷移、の対比）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。

## 1. このユニットで確かめること

`requirements-spec-superseded`（設計レビュー中に要件の見落としに気づき「要件定義やり直し」を supersede で足した）の後、**やり直しの要件定義が完了・承認（accepted）された**。陳腐化していた設計に戻り、**新しい要件に照らして設計を再レビューすると、設計が新要件に合っていない**ことが分かる。何が起きるか：

- **設計はまだ承認（accepted）されていない**（要件問題の発覚でレビューが止まり、implemented〔レビュー待ち〕のまま陳腐化していた）。**確定していないので supersede ではなく後退遷移**で差し戻す（MODEL v19 で確定した「accepted は supersede／implemented は後退遷移」の線）。
- **設計のレビュー作業は完了（出来高 +1）**——再レビューという作業は実際に行われ、「合っていない」という結論を出した。
- **設計本体は完了状態から外れ、出来高が一旦失われる（5→0・二値）**。ここが (1) との決定的な対比：
  - **(1) 要件の supersede**：旧要件は `accepted` のまま残り、**累積出来高には 3 が残った**（働いた事実は消えない）。
  - **(2) 設計の後退遷移**：設計は `implementing` に戻る＝**「完了」でなくなる**ので、**現在 EV% からも累積出来高からも 5 が落ちる**。
  - この違いが「なぜ確定済み(accepted)は supersede で温存し、未確定(implemented)は後退で落とすか」を裏から照らす——**確定していない仕事は、やり直しになれば正直に消える**。
- **設計の後退で P5 at-risk 警告が立つ**：設計は一度 `implemented`（完了）に到達してから `implementing` へ後退するため、warnings.ts の P5 条件（implemented 到達後に後退し未再到達）が発火する＝「仕様FIX 判定の誤り／再作業」の正直な異常信号。これは確定済み姉妹 `requirements-spec-returned`（差し戻しで P5 at-risk を明示）と**同型**。(1) で「自動警告が立たなかった」陳腐化が、ここで初めて**導出信号（P5 at-risk）になる**。
- **玉が AI に移り、AI が新要件に沿って設計を作り直す**（implementing）。再び完了すれば出来高は戻る（その先は別ユニット）。
- 旧要件への陳腐化（依存）は**要件やり直しの完了時点で構造的には解消済み**（上流が完成した）で、残っていたのは「設計の中身が新要件に合うか」という**人間の再レビュー判断**だった——それが「合わない」と出たのが本ユニット。

## 2. 前提（Given）

`requirements-spec-superseded` の後、「要件定義やり直し」が accepted まで完了し、設計の依存はやり直し（accepted）に張り替わっている。設計は implemented（レビュー待ち）のまま。人間が新要件で設計を再レビューしようとしている。

| ノード | 見積状態 | 見積値 | lifecycle | 担当 / レビュー担当 | 現在 EV_abs 寄与 |
|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | 8（現在有効・子合計） |
| └ 要件定義（旧） | agreed | 3 | accepted・**superseded** | 🤖 Claude / 👤 太郎 | 0（現在から除外・累積のみ） |
| └ 要件定義やり直し | agreed | 2（例示） | accepted（完了・承認済み） | 🤖 Claude / 👤 太郎 | 2 |
| └ レビュー作業（要件・旧） | agreed | 1（例示） | accepted | 👤 太郎 / — | 1（旧要件のみ supersede・兄弟は残る） |
| └ 設計 | agreed | 5 | implemented（レビュー待ち・陳腐化していた） | 🤖 Claude / 👤 太郎 | 5 |
| └ レビュー作業（設計） | agreed | 1（例示） | implementing（太郎が新要件で再レビュー中） | 👤 太郎 / — | 0 |
| └ タスク / レビュー作業（タスク） | agreed | 2 / 0.5 | pending | — | 0 |

- 現在 EV%（達成率）：**≈70%**（現在 EV_abs 8〔やり直し2＋レビュー要件1＋設計5〕 ÷ 現在有効集合の合意済み見積 11.5）
- 累積出来高（EV_abs・supersede 含む）：**11**（旧要件3＋やり直し2＋レビュー要件1＋設計5）※累積は surface-health の責務
- 実行カバレッジ（R-S8）：**17%**（`implementing` は設計レビュー作業の 1 葉のみ / 6。やり直しは accepted・設計は implemented）
- 玉（次の手番）：人間（太郎が設計を新要件で再レビュー中）

## 3. ふるまい（When / Then）

```
When  「要件定義やり直し」が完了（implemented）し人間が承認（accepted）した後、
      その新しい要件に照らして設計を改めてレビューすると、
      設計が新要件に合っていない（やり直しの影響を受けていた）ことが分かる。
Then  設計はまだ承認されていない（レビュー待ち implemented のまま陳腐化していた）ので、
      確定済みでない＝supersede ではなく、設計を後退遷移（implemented→implementing）で
      差し戻して作り直す。
And   設計のレビュー作業は完了（出来高 +1）し、設計本体は完了状態から外れて
      出来高が一旦失われる（5→0・二値）——「完了」として持っていた設計の出来高が、
      やり直しの現実化で正直に下がる。
And   この出来高 5 は現在の達成率からも累積出来高からも落ちる
      （要件 supersede のときは旧の出来高が累積に残ったのと対照的）。
And   玉が AI に移り、AI が新要件に沿って設計を作り直す（implementing）。
And   旧要件への陳腐化（依存）は要件やり直し完了時点で構造的には解消済みで、
      残っていたのは「設計の中身が新要件に合うか」という再レビュー判断だった。
And   AI が設計を作り直して再び完了に達すれば出来高は戻る（その先は別ユニット）。
```

<small>注：設計は `implemented`（未 accepted）なので後退遷移（`implemented→implementing`）で差し戻す——完了ノードでも未確定なら後退は P5 の正規の信号（returned/re-returned と同型）。`accepted` だった要件が supersede だったのと機構が分かれるのは「確定状態（finalization）」による（MODEL §2.5/§2.7/R-D7・前段の moira-model-update 決定）。後退で設計は「完了」でなくなるため、ev.ts の `COMPLETED={implemented,accepted}` 判定から外れ、現在 EV_abs と累積 EV_abs の両方から脱落する（supersede の旧ノードは accepted のまま残り累積に効くのと対照）。設計レビュー作業は再レビューという実作業を行い完了（+1）。書き込みの実体は未実装スキル（`moira-progress` 仮称・⚠）。</small>

## 4. 画面の変化（Before → After）

2断面：**Before**（やり直し承認済み・設計を再レビュー中）→ **After**（再レビューで不一致→設計を後退遷移で差し戻し）。

### 4-1. spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value（Before — やり直し承認済み・設計を新要件で再レビュー中）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現在出来高</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現在 EV% <b>70%</b>（8/11.5）・累積 <b>11</b></td>
  </tr>
  <tr style="background:#fafafa;color:#94a3b8">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><s>└ 要件定義（旧）</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><s>3</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e5e7eb;border-radius:4px;padding:1px 6px">置換済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 / 👤</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">累積のみ 3</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義やり直し</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">2</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（陳腐化・再レビュー対象）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>5</b></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">再レビュー中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件・旧）／タスク群</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="3"><span style="color:#94a3b8">（レビュー要件旧=accepted EV1〔§7〕・タスク群=pending）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#7f1d1d;color:#fff"><td colspan="5" style="padding:6px 10px">🌳 spec-value（After — 再レビューで不一致→設計を後退遷移で差し戻し・AI 作り直し）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現在出来高</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">現在 EV% <b style="color:#dc2626">35%</b>（70%→35%・4/11.5）<br><span style="color:#64748b;font-size:11px">（累積出来高 11→7 は surface-health の責務）</span><br><span style="color:#dc2626;font-size:11px">⚑ 設計の出来高5が現在からも累積からも脱落（後退遷移＝supersede と違い完了でなくなる）</span><br><span style="color:#dc2626;font-size:11px">⚑ 設計は P5 at-risk（implemented 到達後に後退＝仕様FIX判定の誤り／再作業の正直な信号）</span></td>
  </tr>
  <tr style="background:#fafafa;color:#94a3b8">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><s>└ 要件定義（旧）</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><s>3</s></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e5e7eb;border-radius:4px;padding:1px 6px">置換済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 / 👤</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">累積のみ 3</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義やり直し</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#86efac;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">2</td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 設計</b>（差し戻し・作り直し中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">作り直し中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#dc2626;font-size:11px">◀ implemented→implementing（後退・玉=AI）<br>⚑ P5 at-risk（implemented 到達後の後退）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">0</b>（5→0・現在も累積も脱落）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#d1fae5;border-radius:4px;padding:1px 6px">完了</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>1</b>（再レビューを完了＝不一致を発見）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件・旧）／タスク群</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="3"><span style="color:#94a3b8">（レビュー要件旧=accepted EV1〔§7〕・タスク群=pending）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1</td>
  </tr>
</table>

<small>※ **(1) supersede と (2) 後退遷移の対比（このユニットの核）**：(1) 要件の supersede では旧要件は `accepted` のまま残り、累積出来高 9 は不変だった（「働いて確定した事実」は消えない）。(2) 設計の後退遷移では設計が `implementing` に戻り「完了」でなくなる→ `COMPLETED={implemented,accepted}`（ev.ts）から外れ、**現在 EV%（70%→35%）も累積（11→7）も 5 を失う**。この非対称が「確定済み(accepted)は supersede で温存／未確定(implemented)は後退で正直に落とす」という機構分けの理由そのもの。設計が作り直されて再び implemented に達すれば 5 は戻る（別ユニット）。</small>

### 4-2. schedule-time 画面 — 玉の動き

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（設計を再レビュー中）— 玉＝人間</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計（implemented・新要件で再レビュー中）<span style="color:#b45309"> ◀ 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（設計を後退遷移で差し戻し）— 玉＝AI（設計を作り直し）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当 / レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>設計</b>（implementing・作り直し）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">🤖 Claude / 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（設計）＝implemented <span style="color:#64748b"> ◀ 再レビューを完了して implemented になったので queues.ts の導出で在席（二次レビューは畳んで底打ち・§7#18(b)(viii)）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">👤 太郎 / —</td>
  </tr>
</table>

<small>※ 設計（本体）が `implemented→implementing` に後退し humanReviewQueue から外れ agentWorkQueue（玉＝AI）へ（queues.ts・差し戻し returned/re-returned と同一の導出）。一方、設計レビュー作業は再レビューを完了して `implemented` に達したので queues.ts（actor 非依存・implemented 葉を入れる）により**humanReviewQueue に在席する**（空ではない）——returned と同型で、二次レビューは提示層で畳んで底打ちしてよい（§7#18(b)(viii)）。「玉」は俗称で、この After は agentWorkQueue（設計）と humanReviewQueue（設計レビュー作業）の両方に在る。</small>

### 4-3. 素のデータ（After）

| ノード | lifecycle | 見積 | 現在 EV_abs 寄与 | 累積 EV_abs 寄与 |
|---|---|---|---|---|
| 要件定義（旧） | accepted・superseded | 3 | 0（現在除外） | ✅ 3 |
| 要件定義やり直し | accepted | 2 | 2 | 2 |
| レビュー作業（要件・旧） | accepted | 1 | 1（旧要件のみ supersede・兄弟は残る） | 1 |
| 設計 | implementing（後退・**P5 at-risk**） | 5 | ❌ 0 | ❌ 0（完了でなくなり累積からも脱落） |
| レビュー作業（設計） | implemented | 1 | 1 | 1 |
| タスク / レビュー作業（タスク） | pending | 2 / 0.5 | 0 | 0 |

現在 EV%：**≈35%**（現在 EV_abs 4〔やり直し2＋レビュー要件1＋レビュー設計1＋設計0〕 / 現在有効集合の合意済み見積 11.5）<br>
累積 EV_abs：**7**（11→7。設計の5が「完了」でなくなり脱落／レビュー設計が +1 で完了＝差引 −4。※累積は surface-health 責務）<br>
実行カバレッジ：**17%**（`implementing` 1〔設計〕/ 6。Before も 17%＝設計レビュー作業1で不変、内訳が移っただけ）<br>
P5 at-risk：**設計**（implemented 到達後に後退し未再到達＝warnings.ts の P5 条件で発火）<br>

<small>※ 例示見積（やり直し2・各レビュー1/0.5）は確定値でない。「累積 11→7」は設計脱落 −5＋設計レビュー作業完了 +1 の差引 −4 で 11→7（−5 で 6 ではない）。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① 設計レビュー完了 `transition`（レビュー作業（設計）→implemented・actor 太郎・不一致を発見）、② 設計差し戻し `transition`（設計 implemented→implementing・後退・actor 太郎・理由付き）、③ 設計作り直し着手 `transition`（設計 implementing・assignee Claude） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-design-reworked-after-redo.md`） | 新要件で設計を再レビューした結果「合わない」と判断した根拠、後退遷移（supersede でなく）を選ぶ理由＝設計が未 accepted、出来高が現在も累積も落ちる正直さ |
| **spec-value 画面 / schedule-time 画面** | 設計が「レビュー待ち→作り直し中」、設計レビュー作業が「再レビュー中→完了」、現在 EV% 70%→35%・累積 11→7、玉が太郎→AI（§4） |

```json
[
  {
    "id": "e110", "ts": 110,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "新要件に照らして設計を再レビュー＝完了。設計が新要件に合っていないと判断"
  },
  {
    "id": "e111", "ts": 111,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "設計が新要件に不一致のため差し戻し。implemented→implementing の後退（未 accepted ゆえ supersede でなく後退遷移）。reachedImplemented は真のまま→P5 at-risk が立つ"
  }
]
```

<small>注：ノード ID・ts・見積は例示。transition のフィールドは `types.ts` の `TransitionEvent`（`machine`・`to`・`assignee?`・`reason?`）に一致。**e110** は設計レビュー作業の完了（再レビューを実施し「不一致」を返した＝出来高 +1。一度 implementing だったノードを implemented へ単調前進＝二度目レビューの往復ではない）。**e111** は設計本体の後退遷移（`implemented→implementing`）——設計は未 accepted ゆえ後退が正規（returned/re-returned と同型の P5 信号）。**後退後も `reachedImplemented` は真のまま・lifecycle は非完了ゆえ warnings.ts の P5 条件が発火＝設計が at-risk になる**（後退遷移を扱う本ユニットの正直な信号で、確定済み姉妹 requirements-spec-returned と同型）。後退で設計は `COMPLETED` から外れ、現在 EV_abs と累積 EV_abs の両方から 5 が落ちる（supersede の旧ノードが accepted のまま累積に残るのと対照）。assignee=Claude（作り直す側）。要件やり直しが accepted 済みなので「未完了の上流に依存」という構造的陳腐化は既に解消しており、本ユニットの差し戻しは中身の不一致（人間の再レビュー判断）による。書込み機構は未実装（`moira-progress` 仮称・⚠）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 要件やり直しが承認（accepted）された後に設計を新要件で再レビューし、設計が新要件に合っていないと判断したとき、**システムは** 設計を後退遷移（implemented→implementing）で差し戻さ**なければならない**（設計は未 accepted ゆえ supersede ではなく後退遷移）。
- **WHEN** 設計が差し戻されたとき、**システムは** 設計の出来高を完了状態から外して失わせ**なければならない**（5→0・二値。未完了は出来高を持たない）。
- **WHEN** 設計が後退遷移で差し戻されたとき、**システムは** その出来高を現在の達成率だけでなく累積出来高からも外さ**なければならない**（後退で「完了」でなくなるため。確定済みノードを supersede したときに累積へ残すのとは異なる）。
- **WHEN** 設計の再レビューが行われたとき、**システムは** 設計のレビュー作業を完了として扱い、その出来高を計上**しなければならない**（再レビューという作業は実際に行われた）。
- **WHEN** 設計が「完了（implemented）に達した後に」差し戻された（後退した）とき、**システムは** 設計を at-risk（仕様FIX判定の誤り／再作業の警告＝P5）として現さ**なければならない**（到達前の差し戻しは正常フロー、到達後は異常という P5 の区別）。
- **WHEN** 設計（本体）が差し戻されたとき、**システムは** 設計（本体）を人間レビュー待ちから外し、エージェント（AI）が作り直す側（玉＝AI）に現さ**なければならない**（一方、再レビューを完了した設計のレビュー作業は implemented として人間レビュー待ちに在席する）。
- **WHILE** 設計の作り直しが完了していない間、**システムは** 設計の出来高を増やし**てはならない**（再完了で初めて出来高が戻る）。
- **WHEN** 要件やり直しが完了（accepted）したとき、**システムは** 「未完了の上流に依存する」という構造的な未充足は解消されたものとして扱い、残る判断を中身の再レビュー（人間）に委ね**なければならない**（中身が合うかは導出でなく人間判断）。
- 注：本ユニットはコスト（AC）・コスト効率（CPI）・予定価値（PV）・スケジュール（SPI）は対象外（別軸）。累積出来高は surface-health が host し、spec-value は現在 EV% を host する。

## 7. 決定事項

- **機構は確定状態で分かれる（前段 moira-model-update）。** 設計は未 accepted（implemented）ゆえ supersede でなく**後退遷移**で差し戻す。accepted（要件）の手戻りは supersede（(1)）。
- **(1) supersede（累積温存）と (2) 後退遷移（累積も脱落）の対比が機構分けの理由。** 後退で設計は「完了」でなくなり `ev.ts` の `COMPLETED={implemented,accepted}`（computeEvAbs・computeCumulativeEvAbs 双方が使用）から外れ、**現在 EV% も累積も** 5 を失う。累積 11→7＝設計 −5＋設計レビュー作業 +1 の差引 −4。一方 (1) の supersede では旧は accepted のまま累積に残る。
- **設計の後退で P5 at-risk が立つ。** `implemented` 到達後に後退し未再到達ゆえ `warnings.ts` の P5 条件が発火＝「仕様FIX 判定の誤り／再作業」の正直な異常信号。確定済み姉妹 `requirements-spec-returned` と同型。(1) で自動信号化しなかった陳腐化が、ここで初めて導出信号になる。
- **設計レビュー作業は再レビュー完了で +1・implemented となり humanReviewQueue 在席。** `queues.ts` は actor 非依存で implemented 葉を入れる（二次レビューの畳みは提示層・§7#18(b)(viii)）。「玉」は俗称で After は agentWorkQueue（設計）と humanReviewQueue（設計レビュー作業）の両方に在る。
- **陳腐化の構造的解消。** 要件やり直しが accepted で上流は完成＝「未完了の上流に依存」という未充足は解消済み。残るは「設計の中身が新要件に合うか」という人間の再レビュー判断（導出でなく人間）で、それが「合わない」と出たのが本ユニット。
- **【既知 nit / D3】R-D7「completed ノードの後退禁止」の射程。** completed は accepted（確定）限定と読む。`implemented`（未確定）の差し戻し（本ユニット・returned）は正規後退（P5）。MODEL 用語未確定の既知 nit。
- **範囲。** 結末は作り直しパスのみ（「合う→そのまま承認」は別ユニット）。precondition の「やり直し完了往復（implementing→implemented→レビュー→accepted）」は (1) の続きで本ユニット外。AC/CPI/PV/SPI は対象外（別軸）。累積は surface-health host・現在 EV% は spec-value host。

検証：doc-adversary×3（G1–G4＋SC1–SC7）→ 著者パッチ → doc-gate-judge **PASS**（生存 Critical/Important = 0・warnings.ts/ev.ts/queues.ts/MODEL/requirements で現物照合・SOURCE_SET_CONFIRMED）。
