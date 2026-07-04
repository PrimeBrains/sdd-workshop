---
id: units/requirements-spec-re-returned
title: 二度目のレビュー差し戻しではレビュー作業行の出来高は据え置き・行も増えず、ACだけが増えてCPIが悪化する（「繰り返し差し戻されている」がコスト効率の正直な信号として見える）
status: in-review
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: Claude が前回のレビュー指摘を受けて要件定義を再作成し、再び「レビュー待ち（implemented）」にした状態。レビュー作業（要件定義）は前回のレビューで完了済み（implemented・EV=1）。ユニット requirements-spec-returned の後 ＋ Claude の再作業完了後
postcondition: 太郎の二度目のレビュー差し戻しで要件定義が再び implementing に後退（EV 3→0）。レビュー作業行は変化なし（implemented・EV=1 据え置き）。二度目のレビュー工数は AC としてのみ計上され CPI が悪化。EV% は 32%→8% に後退（初回差し戻し後と同値だが AC が大きい＝CPI が悪い）
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 3.4, 3.5, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6"
  - "moira-evm: 1.1, 1.2, 2.1, 9.2, 9.5, 11.1, 11.2"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 8.1, 3.4, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 二度目のレビュー差し戻しではレビュー作業行の出来高は据え置き・行も増えず、ACだけが増えてCPIが悪化する（「繰り返し差し戻されている」がコスト効率の正直な信号として見える）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

先行ユニット `requirements-spec-returned`（太郎の初回レビュー差し戻し）の後、Claude が指摘対応で要件定義を再作成し、再度「レビュー待ち」にした。ここで**太郎が二度目のレビューを行い、再び指摘で差し戻す**と何が起きるか。中核は **「繰り返しの差し戻しが EV% ではなく CPI（コスト効率）に現れる」**こと：

- **レビュー作業行の出来高（EV）は変わらない**——前回のレビューで既に完了・出来高100%に到達しており、二度目のレビューでは増えない。
- **二度目のレビューのために新しい行（作業ノード）は追加されない**——二度目のレビュー工数は畳んで（fold）実コスト（AC）としてのみ計上する。
- **AC だけが増えて CPI が悪化する**——出来高を伴わない AC の増大は、CPI＝EV_abs/AC の悪化として正直に現れる。「レビューが計画以上にかかっている」正直な信号。
- **要件定義の出来高は再び 3→0 に後退する**——初回差し戻しと同じ P5 後退（二値）。EV% は 32%→8% に戻り、初回差し戻し後（8%）と同値になる。**同じ 8% でも AC が大きい**——この違いが CPI に映り、「繰り返し差し戻されている」と「初めて差し戻された」を区別する。
- 初回差し戻しとの非対称：初回はレビュー作業ノードの lifecycle が動き EV が 0→1 と変化した。二度目はレビュー作業ノードに一切の変化がなく、信号は **AC の増大（→ CPI 悪化）と要件定義の P5 後退（at-risk）**に現れる。

## 2. 前提（Given）

ユニット `requirements-spec-returned` の後、Claude が指摘対応で要件定義を再作成し、再び「レビュー待ち（implemented）」にした状態（中間ステップ：将来 `requirements-spec-redrafted` としてユニット化可能）。レビュー作業（要件定義）は前回のレビューで完了済み（implemented・EV=1）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 4（子の合計） |
| └ 要件定義 | agreed | 3人日 | implemented（再度レビュー待ち） | 🤖 Claude（再作成者） | 👤 太郎 | 3（再度完了∧合意済み） |
| └ レビュー作業（要件定義） | agreed | 1人日（例示） | implemented（前回レビュー完了・据え置き） | 👤 太郎 | — | 1（据え置き） |
| └ 設計 | agreed | 5人日 | pending | —（対象外） | — | 0 |
| └ レビュー作業（設計） | agreed | 1人日（例示） | pending（対象外） | — | — | 0 |
| └ タスク | agreed | 2人日 | pending | —（対象外） | — | 0 |
| └ レビュー作業（タスク） | agreed | 0.5人日（例示） | pending（対象外） | — | — | 0 |

- 出来高 EV%（達成率）：**32%**（EV_abs 4〔要件定義 3＋レビュー作業 1〕 ÷ 合意済み有効葉の見積合計 12.5。Claude の再作業で要件定義が再び implemented に到達し出来高 3 を回復）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 6 / 既知の有効葉 6）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**0%**（`implementing` の合意済み有効葉 0 / 6。要件定義は implemented、他は pending）
- 人間レビュー待ちキュー：**2 件（導出）**（要件定義＝`implemented`・レビュー担当 太郎 と、レビュー作業ノード＝`implemented` の両葉。キュー導出は actor 非依存で `implemented` 葉が入る＝MODEL §7#18(b)(viii)。提示層は二次レビューを畳んで 1 件に底打ちしてよいが、**素の導出件数は 2**）
- 玉（次の手番）：人間（太郎が二度目のレビューをすべき）
- AC：Claude の初回作業＋太郎の初回レビュー（レビュー作業ノード自身の実コスト）＋Claude の再作業（実績値は例示省略。AC は事実の記録でゼロにならない）

## 3. ふるまい（When / Then）

```
When  Claude が前回のレビュー指摘を受けて要件定義を再作成し、
      再び「レビュー待ち（implemented）」にした後、
      太郎が二度目のレビューを行い、再び指摘事項を見つけて差し戻す。
Then  レビュー作業（要件定義）の行の出来高は変わらない
      ——前回のレビューで既に完了（出来高＝見積満額）しており、
      二度目のレビューでは増えない。
And   二度目のレビューのために新しいレビュー作業行は追加されない。
And   太郎の二度目のレビューで費やした工数は実コスト（AC）としてのみ積み上がり、
      出来高を伴わないため CPI が悪化する。
And   差し戻しにより要件定義は再び「再作業中（implementing）」に後退し、
      要件定義ぶんの出来高は再び失われる（3→0）。
And   差し戻しの遷移ログが記録される。
And   三度目以降の往復も同じパターン
      （レビュー行の EV は据え置き・行は増えず・AC だけが積み上がる）。
And   Claude が指摘対応を再度行う先（再々作業）は別ユニットの対象。
```

<small>注：二度目のレビュー工数は**畳んで（fold）**実コスト計上する——MODEL §7#18(b) の「軽微なら畳む」P0 判断。畳んだレビュー作業の cost は被レビューノード（要件定義）に帰属する（§7#18(b)(iv)）。レビュー作業ノードの lifecycle は変化しない（implemented のまま）。初回レビューと異なり、二度目はレビュー作業ノードの lifecycle 遷移（ready→implementing→implemented）が発生せず、信号は **AC の増大（→ CPI 悪化）と要件定義の P5 後退（at-risk）**に現れる（初回のようなレビュー作業ノードの状態変化は起きない）。差し戻し自体は初回と同じ `implemented→implementing` の P5 後退遷移。レビュー作業のノード化は初回のレビュー（計画段階で立てた作業ノード）のものであり、二度目以降はそのノードに対して畳む。書き込み（cost／差し戻し transition の emit）の実体は未実装スキル（`moira-progress` 仮称・⚠）が担う（先行ユニットと同じ）。</small>

## 4. 画面の変化（Before → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%・CPI）＋ schedule-time（玉＝キュー移動）**。2断面：**Before**（Claude の再作業完了後・再度レビュー待ち）→ **After**（太郎の二度目のレビュー差し戻し）。初回差し戻し（先行ユニット）と異なり「During（レビュー中）」は描かない——二度目のレビューではレビュー作業ノードの lifecycle が動かないため、画面に明示的な「レビュー中」断面が現れない（§7）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高・CPI）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — Claude が再作業完了・要件定義は再度レビュー待ち）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>32%</b>（4/12.5）・実行 <b>0%</b>・見積カバレッジ <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（再度レビュー待ち）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3</b>（再度完了・満額）</td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）（前回完了・据え置き）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#d1fae5;border-radius:4px;padding:1px 6px">完了</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 1（据え置き）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計〜レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外。計4葉・合計 8.5人日）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — 太郎が二度目のレビュー完了＋再び指摘で差し戻し）</td></tr>
  <tr style="background:#f1f5f9">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">ノード</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">状態</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー担当</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 / 被覆 / CPI</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#dc2626">8%</b>（32%→8%）・実行 <b>17%</b>（1/6）・見積カバレッジ <b>100%</b><br><span style="color:#dc2626">⚑ CPI 悪化（AC 増大・EV は初回差し戻し後と同値だが AC が大きい）</span><br><span style="color:#b45309">⚑ 要件定義は二度目の差し戻しで再作業中（P5 at-risk）</span></td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（二度目の差し戻し・再作業中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">再作業中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#dc2626;font-size:11px">◀ 二度目の差し戻し（implemented→implementing）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI（再々作業）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">EV寄与 0</b>（3→0・二度目の差し戻しで再び失う）<br><span style="font-size:11px">AC：初回作業＋再作業＋二度目レビュー分が残存</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）（<b>変化なし</b>）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#d1fae5;border-radius:4px;padding:1px 6px">完了</span> <span style="color:#64748b">(implemented)</span><br><span style="color:#64748b;font-size:11px">変化なし——二度目のレビューでは lifecycle が動かない</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 1</b>（据え置き・変化なし）<br><span style="font-size:11px">このノード自身の AC は初回レビュー分のまま変化なし。<b>二度目のレビュー工数は畳んで被レビューノード＝要件定義に帰属</b>（§7#18(b)(iv)）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計〜レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外。計4葉・合計 8.5人日）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ **初回差し戻し（先行ユニット）との比較**：初回は EV% 24%→8%（レビュー作業の EV＋1 と要件定義の EV−3 の差し引き）、二度目は 32%→8%（要件定義の EV−3 のみ。レビュー作業に変化なし）。After の EV% はどちらも **8%** だが、AC が異なる——二度目の After は Claude の再作業分＋太郎の二度目のレビュー分だけ AC が大きく、CPI はさらに悪い。**「同じ 8% でも CPI が違う」が、EV% だけでは見えない繰り返し差し戻しの信号**。CPI = EV_abs / AC（MODEL §3・moira-evm Req 9.2）。CPI の分子（完了 EV_abs のみ）と分母（WIP を含む AC）の非対称ゆえ、WIP 中は CPI が悲観側に振れる——これは正規化せず開示する（moira-evm Req 9.5）。</small>

### 4-2. schedule-time 画面 — 玉の動き（差し戻し後＝AI 再々作業）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 Before（Claude が再作業完了・再度レビュー待ち）— 玉＝人間（太郎が二度目のレビューをすべき）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">エージェント作業キュー</td>
    <td colspan="2" style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">（空）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" rowspan="2">人間レビュー待ちキュー<br><span style="font-size:11px;color:#64748b">（導出 2 件・actor 非依存）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義（再度レビュー待ち＝implemented）<span style="color:#b45309"> ◀ 太郎が二度目のレビューをすべき</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 🤖 Claude / レビュー担当 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）＝implemented <span style="color:#64748b">（品質確認待ち・提示層は畳んで隠してよい・§7#18(b)(viii)）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 👤 太郎 / レビュー担当 —</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（二度目の指摘で差し戻し）— 要件定義の玉＝AI（再々作業）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義</b>（二度目の再作業中＝implementing）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）＝implemented <span style="color:#64748b">（初回から継続在席・再入場ではない。二次レビューは畳む・先行ユニットと同じ）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 👤 太郎 / レビュー担当 —</td>
  </tr>
</table>

<small>※ 差し戻しで要件定義は `implemented`→`implementing` に戻り、人間レビュー待ちキューから抜けて再びエージェント作業キューに入る。これは初回差し戻し（先行ユニット）と同一の導出（`queues.ts`・actor 非依存）。二度目の差し戻しで異なるのは**AC の積み上がり**のみで、キューの動きは初回と構造的に同じ。</small>

### 4-3. 作業の詳細＋素のデータ（After）

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実コスト AC | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|---|
| └ 要件定義 | implementing（二度目の差し戻し・再作業中） | agreed（3人日） | Claude | 太郎 | ❌ 0（未完了＝二値・二度目の差し戻しで失う） | 初回作成＋再作業＋**二度目のレビュー工数（畳んで帰属・§7#18(b)(iv)）**＋再々作業で増 | ✅（`implementing`＝1） |
| └ レビュー作業（要件定義） | implemented（変化なし） | agreed（1人日・例示） | 太郎 | — | ✅ 1（据え置き） | 初回レビュー分のみ（このノード自身の実コスト・変化なし） | ❌（`implementing` でない） |
| └ 設計 | pending | agreed（5人日） | — | — | ❌ 0 | 0 | ❌ |
| └ タスク | pending | agreed（2人日） | — | — | ❌ 0 | 0 | ❌ |
| └ レビュー作業（設計） | pending | agreed（1人日・例示） | — | — | ❌ 0 | 0 | ❌ |
| └ レビュー作業（タスク） | pending | agreed（0.5人日・例示） | — | — | ❌ 0 | 0 | ❌ |

出来高 EV%：**8%**（EV_abs 1〔レビュー作業のみ〕 / 合意済み有効葉の見積総和 12.5。初回差し戻し後（先行ユニット After）と同値）<br>
実行カバレッジ：**17%**（`implementing` の合意済み有効葉 1〔要件定義の再作業〕 / 6）<br>
見積カバレッジ（P2）：**100%**（合意済み有効葉 6 / 既知の有効葉 6）<br>
CPI：**EV_abs(1) / AC(初回作業＋初回レビュー＋再作業＋二度目のレビュー) < 初回差し戻し後の CPI**——同じ EV% 8% でも CPI は初回差し戻し時より悪い

<small>※ **CPI が「繰り返し差し戻されている」を映す**：EV% は初回差し戻し後と二度目の差し戻し後で同じ 8% だが、AC は二度目のほうが大きい（Claude の再作業分＋太郎の二度目のレビュー分が加算されている）。CPI = EV_abs / AC（MODEL §3）は AC が大きいほど悪化するので、**CPI の値を比較すれば「初回差し戻しなのか、繰り返し差し戻しなのか」が区別できる**。EV% だけでは区別できない——これが AC を正直に残す（A6「コストは事実」）設計の帰結。</small>

### 4-4. decision インボックス（横断）— 二度目の差し戻しも「警告」区画に信号として出る（判断項目にはならない）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🗂 decision インボックス（横断）（After）— 判断種別の4区画（見積合意／担当割当／受入／警告）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;width:34%">見積に合意する</td><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#64748b">— なし（全葉合意済み。差し戻された要件定義も判断項目として出ない） —</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">担当を割り当てる</td><td style="padding:6px 10px;border:1px solid #cbd5e1">担当割当が必要: 設計・タスク・レビュー作業（設計／タスク）の 4 件（合意済み・未割当の可視ギャップ。本ユニットの主題外＝前提木に由来）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1">受入判断する</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>受入判断が必要: F/review-req（完了・検収待ち）</b> — レビュー作業ノードは完了（implemented）のまま変化なし。差し戻された要件定義 F/req はここには出ない（再々作業中＝検収待ちでない）</td></tr>
  <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:600">警告に対処する</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>差し戻しリスク: F/req</b>（P5＝到達後の後退・二度目） — 初回と同様、差し戻しは判断項目にならずリスク信号として警告区画に出る</td></tr>
</table>

<small>※ 2026-07-04 裁定（実画面提示・ユーザー・姉妹ユニット requirements-spec-returned と同裁定）: 従来の「出ない」記述は issue #12 実装（P5 を警告区画に描画）と矛盾が顕在化し、**実装側が正**と裁定された。「差し戻しがコミット判断の区画に判断項目として出ない」ことは従来どおり。E2E は裁定後の挙動を回帰固定済み。</small>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① 二度目のレビュー工数 `cost`（太郎の二度目のレビュー分。被レビューノード＝要件定義に帰属。§7#18(b)(iv)）、② 二度目の差し戻し `transition`（要件定義 →implementing・後退・actor 太郎・理由付き）。**レビュー作業ノードには transition イベントが発生しない**（lifecycle 変化なし＝初回差し戻しとの最大の違い） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-re-returned.md`） | 太郎の二度目のレビュー指摘の内容・根拠、「再び差し戻して再々作業」という判断、CPI 悪化の事実 |
| **spec-value 画面 / schedule-time 画面** | 要件定義が「レビュー待ち→再作業中」へ後退し出来高 0、レビュー作業は変化なし（EV 1 据え置き）、玉が太郎→AI へ、EV% 32%→8%、CPI 悪化（§4） |

```json
[
  {
    "id": "e080", "ts": 80,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "cost",
    "node": "F/req",
    "amount": 0.5
  },
  {
    "id": "e081", "ts": 81,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "二度目のレビュー指摘により差し戻し（再々作業）。implemented→implementing の後退＝P5（二度目）"
  }
]
```

<small>注：ノード ID・ts 値・cost amount は例示で実装が決める。**e080** は二度目のレビュー工数の `cost` イベント——畳んだレビュー作業の cost は被レビューノード（F/req＝要件定義）に帰属する（MODEL §7#18(b)(iv)・est(x) の畳み cost と同型）。`cost` イベントは `kind`/`node`/`amount` のみ（`reason` フィールドを持たない＝`moira/backend/src/types.ts` の `CostEvent`）。畳み帰属の根拠はこの注と差し戻し transition（e081）の `reason` で記録する。amount は例示（0.5人日）で実際のレビュー工数に依る。**e081** は二度目の差し戻し＝要件定義を `implemented→implementing` へ後退。初回差し戻し（先行ユニット e075）と同一の P5 後退パターン。assignee=Claude（再々作業する側）。**レビュー作業ノード（F/review-req）には新たなイベントが発生しない**——初回差し戻しとの最大の構造的違い。初回は e073/e074（レビュー作業の ready→implementing→implemented）が発生したが、二度目はレビュー作業ノードの lifecycle が動かない。**R-S3 の carve-out**：畳んだレビュー作業の一度きり（one-off）の cost は**それ単独では** thrashing シグナルを立てない（MODEL R-S3＝「EV_abs 非増 ∧ AC が継続的期間にわたり増加」で初めて発火。畳み cost は §7#18(b)(v) で carve-out 済）。ただし**差し戻しが続く**と、被レビューノード（要件定義）は EV が 3→0→3→0 と非増のまま AC が積み上がり、持続的期間（sustained window）に至れば要件定義ノードが正当に thrashing/at-risk として現れうる——carve-out は各回の畳み cost を**単独で**免責するだけで、繰り返し差し戻しを不可視化しない（むしろ §3 が狙う「繰り返し差し戻されている」の正直な信号）。なお spec 側 `moira-evm` Req 11.2 は現状 R-E2b（畳んだ見積活動）の carve-out のみを明記し、**畳んだレビュー作業の carve-out（MODEL §7#18(b)(v)）は未反映**——spec と MODEL の同期が残課題（§7）。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** レビュー作業行の出来高を変え**てはならない**（既に完了・出来高100%に到達済みで、二度目のレビューでは増えも減りもしない）。
- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** 二度目のレビューのために新しい作業行を追加**してはならない**（二度目のレビュー工数は畳んで実コストに計上する）。
- **WHEN** 二度目のレビューの工数が記録されたとき、**システムは** その工数を実コスト（AC）としてのみ計上し、出来高（EV）を動かし**てはならない**——出来高を伴わない実コストの増大は CPI を悪化させる。
- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** レビュー作業（要件定義）の作業の進み具合（lifecycle）を変え**てはならない**（完了のまま。二度目のレビューでは作業状態の遷移が起きず、出来高だけでなく状態も動かない）。
- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** 要件定義を「レビュー待ち（作成完了）」から「再作業中」へ戻さ**なければならない**（初回差し戻しと同じ後退遷移）。
- **WHEN** 要件定義が二度目に差し戻されたとき、**システムは** 要件定義ぶんの出来高を失わせ**なければならない**（再作業中は未完了＝出来高 0。途中残しをしない＝初回と同じ二値）。
- **WHEN** 要件定義が二度目に差し戻されたとき、**システムは** すでに費やした実コスト（初回作業＋再作業＋二度目のレビュー分）を保持**しなければならない**（コストは事実）。
- **WHEN** 出来高の達成率とコスト効率を示すとき、**システムは** 同じ達成率（EV%）でも実コストの多寡が区別できるよう、コスト効率（CPI）を別途示さ**なければならない**（初回差し戻し後と二度目の差し戻し後の EV% が同値でも CPI は異なる）。
- **WHEN** 畳んだレビュー工数がコスト計上されたとき、**システムは** それ単独でスラッシュ（出来高が増えないのにコストが増え続ける警告）を出**してはならない**（一度きりの畳んだ工数は想定内）。
- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** 差し戻された作業をインボックスの**コミット判断の区画（見積合意・担当割当・受入）に判断項目として**出**してはならない**（初回と同様・差し戻しはコミット判断ではない）。
- **WHEN** 二度目のレビューで差し戻されたとき、**システムは** 差し戻しリスクの信号（P5）をインボックスの**警告の区画**に現さ**なければならない**（初回と同様・判断項目化ではなく正直な信号として）。
- **WHEN** 要件定義が二度目に差し戻されたとき、**システムは** 要件定義を人間レビュー待ち一覧から外し、再びエージェントが再々作業する側（玉＝AI）に現さ**なければならない**。

## 7. 決定事項

- **二度目以降のレビューは「畳む（fold）」——新ノードも EV も増やさない。** 計画段階で立てたレビュー作業ノード（初回レビュー）に対し、二度目以降のレビュー工数は MODEL §7#18(b) の「軽微なら畳む」P0 判断で畳む。新しい作業ノード（行）を立てず、レビュー作業ノードの出来高（EV）も lifecycle も動かさない。これが §3 の「人間のレビューの行はもう EV 100% なのでそれ以上増えない／二次レビューの行も増えない」の正典的根拠（MODEL §7#18(b)）。
- **畳んだレビュー工数の cost は被レビューノード（要件定義 / F/req）に帰属する。** MODEL §7#18(b)(iv)（est(x) の畳み cost が被見積ノードの AC に入るのと同型）。したがって §3 の「単純に AC だけが増えて」は、AC が**レビュー作業行**でなく**要件定義ノード（と集約）**に積み上がる形で実現する——観測される結論（新 EV なし・新行なし・AC 増・CPI 悪化）は §3 のとおりだが、帰属先は正典に従い被レビューノードとした（§4-1/§4-3 はこの帰属でグラウンディング）。
- **`cost` イベントは `reason` フィールドを持たない。** `moira/backend/src/types.ts` の `CostEvent` は `kind`/`node`/`amount` のみ（`reason` は `TransitionEvent`/`DecomposeEvent` 固有）。畳み帰属の根拠は §5 注と差し戻し transition（e081）の `reason`、および会話ログに記録する。
- **人間レビュー待ちキューの導出は actor 非依存で、`implemented` 葉は二次レビュー対象でも入る（導出 2 件）。** MODEL §7#18(b)(viii)。本ユニットの Before は要件定義（implemented）とレビュー作業（implemented）の 2 葉がともにキューに入る＝**素の導出件数は 2**。提示層は二次レビューを畳んで 1 件に底打ちしてよいが、導出母集合からは消えない（一次/二次の提示上の区別は presentation の責務）。
- **R-S3 の carve-out は各回の畳み cost を「単独で（by itself）」免責するだけで、繰り返し差し戻しを不可視化しない。** MODEL R-S3 は「EV_abs 非増 ∧ AC が継続的期間（sustained window）にわたり増加」で thrashing を発火させ、畳んだレビュー作業の一度きり cost は §7#18(b)(v) で carve-out 済。差し戻しが続けば被レビューノード（要件定義）は EV が 3→0→3→0 と非増のまま AC が積み上がり、持続的期間に至れば正当に thrashing/at-risk として現れうる。これは §3 の「繰り返し差し戻されている」を正直な信号として可視化する設計意図と整合（敵対者 FORK は MODEL R-S3 本文の "by itself"＋"sustained window" から一意に決まるためグラウンディングで決着）。
- **【残課題 / spec-MODEL 同期】`moira-evm` Req 11.2 は畳んだ**見積活動**（R-E2b）の carve-out のみを明記し、畳んだ**レビュー作業**の carve-out（MODEL §7#18(b)(v)）が未反映。** carve-out の正典根拠は MODEL R-S3＋§7#18(b)(v) にあり本ユニットはそれに接地したが、派生 spec（moira-evm）の Req 11.2 がまだ追いついていない。トレースには Req 11.2 を残すが、Req 11.2 を畳んだレビュー作業まで拡張する spec 改訂が別タスクとして必要（MODEL 正典側の欠陥ではないため `moira-model-update` への委譲は不要）。
- **同じ EV% 8% でも CPI で「初回差し戻し」と「繰り返し差し戻し」を区別する。** EV% は初回差し戻し後と二度目の差し戻し後でともに 8% だが、AC は二度目のほうが大きい（Claude の再作業＋二度目のレビューの畳み cost）。CPI = EV_abs/AC（MODEL §3・moira-evm Req 9.2）は AC が大きいほど悪化するため、CPI が両者を区別する。CPI は WIP 中に悲観側へ振れるが正規化せず開示する（moira-evm Req 9.5）。
- **トレース差分（先行ユニット比）の根拠:** `moira-core: 3.4, 3.5`（cost イベントのスキーマ／実コストの単一通貨・EV へ畳み込まない）と `moira-evm: 9.2, 9.5, 11.1, 11.2` を先行ユニットに追加した。本ユニットが初めて `cost` イベント（e080）を emit し、CPI 悪化と thrashing carve-out を主題化したことに対応する。
- **二度目の差し戻しも警告区画の信号として出る（2026-07-04 裁定・§4-4/§6 の改訂）:** 旧版の §4-4/§6 は「二度目の差し戻しもインボックスに出ない」と全面不出現を描いていたが、姉妹ユニット requirements-spec-returned と**同裁定**（E2E 同期 2026-07-04・1f53887・実画面提示のうえユーザーが実装側を正と裁定）により、P5「差し戻しリスク」は**警告区画**に信号として出る形へ改訂。「コミット判断の区画に判断項目として出ない」は不変（DECISIONS-CATALOG D-69）。本改訂で status を `agreed`→`in-review` に降格（再批准待ち）。
