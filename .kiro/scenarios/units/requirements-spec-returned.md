---
id: units/requirements-spec-returned
title: 太郎がレビューして指摘で差し戻すと、レビュー作業の出来高が上がり、要件定義は再作業へ戻る（出来高は正直に後退するが「レビューは進んだ」が見える）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 要件定義が「作成完了・レビュー待ち（implemented）」で、作業者は Claude・レビュー担当は太郎。設計・タスクは見積合意済みで未着手。出来高（EV%）は要件定義ぶん（3人日）だけ上がっている（＝ユニット requirements-spec-drafted の後）
postcondition: 太郎のレビュー作業がノード化されて出来高を獲得し（レビュー作業＝太郎・レビュー中→レビュー完了）、レビュー指摘により要件定義が「再作業中（implemented→implementing の差し戻し）」へ後退して要件定義ぶんの出来高は失われる（3→0）。費やした実コスト（AC）は残り、レビュー作業ぶんの出来高も残るので、フィーチャー全体の出来高は後退しつつ「レビューは進んだ・要件定義は差し戻された」が画面で別々に分かる
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
  - moira-schedule
  - moira-surface-schedule
touches_requirements:
  - "moira-core: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6"
  - "moira-evm: 1.1, 1.2, 2.1"
  - "moira-surface-spec-value: 1.1, 1.3, 1.5, 3.1, 5.1, 5.3, 10.1, 11.1, 11.2, 11.3"
  - "moira-schedule: 3.1, 3.2, 4.1, 4.2, 4.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.4"
  - "moira-surface-schedule: 2.5, 8.1, 3.4, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.3"
---

# 太郎がレビューして指摘で差し戻すと、レビュー作業の出来高が上がり、要件定義は再作業へ戻る（出来高は正直に後退するが「レビューは進んだ」が見える）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家ループが確認します。
> 注：参照実装（`moira/frontend`）は暫定スライスで、本ユニットは「要件としてどうあるべきか」を記述します。各画面要素は**定義済み要件**（frontmatter のトレース）への参照を併記します。スライス未実装は中立に「(スライス未描画)」と記し、設計の宿題（赤字）ではありません。

## 1. このユニットで確かめること

要件定義が「レビュー待ち」になった spec で、**レビュー担当の太郎が実際にレビューし、指摘事項を見つけてプロンプトで差し戻す**と、何が起きるか。中核は **2つの出来高の動きが分離して見える**こと：

- **レビュー作業そのものが出来高を生む**こと。太郎のレビューは「作業者＝太郎・状態＝レビュー中」の**作業ノード**としてモデル化され、レビューが終わると**レビュー作業ぶんの出来高が上がる**（MODEL v19＝レビュー工数を A1 通常作業ノードとして EV 計上。レビュー担当 reviewer の*指名*属性とは別物）。
- **差し戻しで要件定義の出来高は正直に後退する**こと。指摘によって要件定義は「作成完了（レビュー待ち）」から「再作業中」へ戻り（implemented→implementing の後退＝差し戻し）、**要件定義ぶんの出来高は失われる**（3→0・途中残しをしない＝二値）。
- それでも **「何が起きているか分かる」**こと：要件定義の出来高は 0 に戻るが、(a) **レビュー作業ぶんの出来高は残り**（レビューは進んだ）、(b) 費やした**実コスト（AC）は残り**（作業は無駄になっていない）、(c) 再作業はベースを再利用するので**早く終わって出来高は戻る**（次のユニット）。レビュー工数をモデル化しないと、見えるのは要件定義の出来高が 0 に落ちたことだけで「レビューは進んでいるのか／何が起きたのか」が分からない——本ユニットはこの**差し戻しの可視化**を確かめる。

さらに：

- **太郎がレビュー作業をしている間、作業者が太郎・状態がレビュー中**だと画面で分かること（要件定義の作業者は作成者の Claude のまま。新しく現れるのは**レビュー作業ノード**の作業者＝太郎）。
- 差し戻し後、**要件定義が再びエージェント作業キュー（玉＝AI）へ戻り**、レビュー作業は出来高を残して完了していること。
- このレビュー差し戻しが、横断の decision インボックスには出ないこと。

<small>※ 「指摘されたぶんだけ出来高を減らす（例 3→2）」という、より細かい見せ方も考えられるが、それには要件定義を**計画時に複数の葉へ分解**しておく必要があり（差し戻しは指摘された葉だけを後退させる）、本ユニットの前提（要件定義は単一ノード）では成立しない。完了後に後付けで葉を割って出来高を按分する案は、完了施錠（I4）・完了ノード再見積禁止（R-E3）・supersede 規律（§2.7）に抵触し、かつ差し戻しの後退信号（P5）を消すため**敵対ゲートで却下**された。よって単一ノードの本ユニットでは差し戻しは 3→0（粒度＝計画のコミット判断・MODEL §2.1#4。細粒度版は別ユニットの題材）。詳細は §7。</small>

## 2. 前提（Given）

ユニット `requirements-spec-drafted` の後（要件定義が作成完了・レビュー待ち）。要件定義の作業者は Claude、レビュー担当は太郎（指名済み）。設計・タスクは見積合意済みで未着手。**レビュー作業ノードはまだ存在しない**（このユニットで太郎がレビューに入るときに立てる）。

| ノード | 見積状態 | 見積値 | lifecycle | 担当（作業者） | レビュー担当 | 出来高(EV_abs)寄与 |
|---|---|---|---|---|---|---|
| F（フィーチャー） | — | — | pending | — | — | 3（子の合計） |
| └ 要件定義 | agreed | 3人日 | implemented（レビュー待ち） | 🤖 Claude（作成者） | 👤 太郎 | 3（完了∧合意済み） |
| └ 設計 | agreed | 5人日 | pending | —（対象外） | — | 0 |
| └ タスク | agreed | 2人日 | pending | —（対象外） | — | 0 |

- 出来高 EV%（達成率）：**30%**（EV_abs 3 ÷ 合意済み有効葉の見積合計 3+5+2=10。**葉基底**＝MODEL v18）
- 見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 3 / 既知の有効葉 3）
- 実行カバレッジ（R-S8・葉基底＝カウント比）：**0%**（`implementing` の合意済み有効葉 0 / 3）
- 人間レビュー待ちキュー：**1 件**（要件定義＝`implemented`・レビュー担当 太郎）
- 玉（次の手番）：人間（太郎がレビューすべき）

## 3. ふるまい（When / Then）

```
When  要件定義が「レビュー待ち（作成完了・まだ承認前）」になっている spec について、
      レビュー担当の太郎が要件定義を実際にレビューし、指摘事項を見つけて、
      「ここを直して」という指摘依頼をプロンプトで打って差し戻す。
Then  太郎のレビューは「作業者＝太郎・状態＝レビュー中」の作業として画面に現れる。
And   そのレビュー作業が終わると、レビュー作業ぶんの出来高が上がる
      （実際にレビューという作業をしたので、その分の出来高が獲得される）。
And   指摘による差し戻しで、要件定義は「レビュー待ち」から「再作業中」へ戻り、
      要件定義ぶんの出来高は失われる（途中残しをしない＝0 に戻る）。
And   それでも画面では「レビューは進んだ（レビュー作業の出来高は残る）」一方で
      「要件定義は差し戻しで再作業に戻った（要件定義の出来高は下がった）」と、別々に分かる。
And   差し戻された要件定義は、再びエージェント（Claude）が再作業する側（玉＝AI）に戻る。
And   このレビュー差し戻しは、横断の decision インボックスには出ない。
And   要件定義を再作成して再レビューする先（次の往復）は、このユニットの対象外（別ユニット）。
And   太郎がレビューして「指摘なし」で承認へ進む経路（差し戻さない場合）も、別ユニット。
```

<small>注：太郎の「レビュー作業」は MODEL v19 で**通常の作業ノード**としてモデル化できる（運用タスク・バグ修正と同様に「遂行され出来高を生む作業」＝A1 射程内。相応に重ければノード化＝見積・作業者・lifecycle・出来高／軽微なら畳んで実コスト計上＝MODEL §7#18(b)）。本ユニットはレビュー工数を可視化する主眼ゆえノード化する。これは「レビュー担当（reviewer）＝誰がレビューするかの*指名*」（出来高・平準化を動かさない付帯属性）とは**別物**——指名は太郎、レビュー*作業ノード*の作業者も太郎だが、前者は plan、後者は実際の作業のモデル化。「差し戻し」は要件定義の lifecycle が `implemented→implementing` へ後退すること（MODEL P5＝到達後の後退は「仕様FIX判定の誤り／再作業」の正直な信号）。レビュー作業・差し戻しの書き込みの実体は未実装スキル（`moira-progress` 仮称）。「指摘依頼をプロンプトで打つ」の実体は会話（人間の指摘）で、差し戻しの lifecycle 後退を引き起こす。</small>

## 4. 画面の変化（Before → During → After）

採用表現は **spec-value（状態・担当・レビュー担当・出来高 EV%）＋ schedule-time（玉＝キュー移動・レビュー作業の可視化・作業詳細）**。ガントに「進捗バー％」は出さない（出来高 EV% は spec-value/health が host）。3断面：**Before**（レビュー待ち）→ **During**（太郎がレビュー中）→ **After**（指摘で差し戻し）。

### 4-1. spec-value 画面（状態・担当・レビュー担当・出来高）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（Before — 要件定義はレビュー待ち・レビュー作業ノードはまだ無い）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>30%</b>・実行 <b>0%</b>・見積カバレッジ <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（レビュー待ち）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>EV寄与 3</b>（満額・二値）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計 / └ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外。設計5人日・タスク2人日）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#7c2d12;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（During — 太郎がレビュー作業中。レビュー作業ノードを立てて着手）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b>27%</b>（3/11・レビュー作業1人日を計画に足したぶん分母が増えた＝30%→27%）・実行 <b>25%</b>・見積カバレッジ <b>100%</b></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義（レビュー待ち・変化なし）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー待ち</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 3</td>
  </tr>
  <tr style="background:#fffbeb">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ レビュー作業（要件定義）</b>(新規ノード)</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">レビュー中</span> <span style="color:#64748b">(implementing)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝人間（作業中）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0（レビュー中＝未完了）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計 / └ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="6" style="padding:6px 10px">🌳 spec-value（After — 太郎がレビュー完了＋指摘で要件定義を差し戻し）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">出来高 EV% <b style="color:#dc2626">9%</b>（27%→9%）・実行 <b>25%</b>・見積カバレッジ <b>100%</b><br><span style="color:#b45309">⚑ 要件定義は差し戻しで再作業中（P5 at-risk）／レビュー作業は完了し出来高を獲得</span></td>
  </tr>
  <tr style="background:#fef2f2">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ 要件定義</b>（差し戻し・再作業中）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bfdbfe;border-radius:4px;padding:1px 6px">再作業中</span> <span style="color:#64748b">(implementing)</span><br><span style="color:#dc2626;font-size:11px">◀ 差し戻し（implemented→implementing）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span><br><span style="color:#b45309;font-size:11px">◀ 玉＝AI（再作業）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#dc2626">EV寄与 0</b>（3→0・差し戻しで失う）／AC は残る</td>
  </tr>
  <tr style="background:#f0fdf4">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1"><b>└ レビュー作業（要件定義）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日（例示）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#fed7aa;border-radius:4px;padding:1px 6px">レビュー完了</span> <span style="color:#64748b">(implemented)</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#94a3b8">—（二次レビューは畳む＝§7）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b style="color:#16a34a">EV寄与 1</b>（0→1・レビュー作業の出来高）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計 / └ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1" colspan="4"><span style="color:#94a3b8">（pending・対象外）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">EV寄与 0</td>
  </tr>
</table>

<small>※ <b>2つの出来高の動きが分離して見える</b>のが本ユニットの主眼：差し戻しで<b>要件定義の出来高は 3→0</b>（再作業が必要という正直な信号・MODEL P5 非単調・部分残しをしない二値）。同時に<b>レビュー作業の出来高は 0→1</b>（太郎が実際にレビューした作業ぶん）。要件定義の作業者は差し戻し後 Claude のまま（再作業も Claude）。<b>EV% は Before 30%→During 27%→After 9%</b> と動く：30→27 はレビュー作業1人日を計画に足した希釈、27→9 は要件定義の差し戻し。「安定」ではなく、それぞれ正直な信号。<b>「要件定義の出来高が 0 でも作業は無駄でない」</b>のは (a) レビュー作業の EV +1、(b) 費やした実コスト AC の残存（§4-3）、(c) 再作業はベース再利用で安く早い（次ユニット）で読める。<b>レビュー担当（reviewer）の指名属性</b>（太郎）は出来高・平準化を一切動かさない；動くのは<b>レビュー作業ノード</b>と<b>差し戻された要件定義</b>。参照スライス（`SpecValueSurface.tsx`）の担当列・レビュー担当列・レビュー作業ノード行は未描画＝定義済み要件への目標。</small>

### 4-2. schedule-time 画面 — 玉の動き（レビュー中＝太郎作業／差し戻し後＝AI 再作業）

「玉が誰か」は lifecycle から導出する（玉という一級概念は新設しない）。要件: moira-surface-schedule Req13。**注意（継ぎ目）**：現行の導出キューは `agentWorkQueue`（{ready,implementing}∧作業者＝エージェント）と `humanReviewQueue`（`implemented` の葉・actor 非依存）の2つで、**人間が作業中（implementing・作業者＝人間）のレビュー作業ノードは、どちらの導出キューにも入らない**（`queues.ts`）。「太郎がレビュー中」は spec-value のノード状態（レビュー中）と schedule の予定（太郎の容量で平準化＝`leveler.ts`）で可視化（既知ギャップ＝下記）。なお名前付きキューの一覧描画自体が参照スライス未描画（実 `ScheduleTimeSurface.tsx` は actor 種別フィルタ＋未割当バックログ＋ガントのみ）＝定義済み要件への目標。

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 During（太郎がレビュー中）— 玉＝人間（太郎が作業）</td></tr>
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
    <td style="padding:6px 10px;border:1px solid #cbd5e1">人間レビュー待ちキュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義（レビュー待ち＝implemented・承認前）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 🤖 Claude / レビュー担当 👤 太郎</td>
  </tr>
  <tr style="background:#fffbeb">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>スケジュール（ガント）</b><br><span style="font-size:11px;color:#64748b">※人間作業キューは現行なし</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）＝<b>レビュー中</b><span style="color:#b45309"> ◀ 玉＝太郎が作業中</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span>（作業者・容量 c で平準化）</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 After（指摘で差し戻し）— 要件定義の玉＝AI（再作業）</td></tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">キュー / 表示（導出）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">担当（作業者）/ レビュー担当</td>
  </tr>
  <tr style="background:#eff6ff">
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>エージェント作業キュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>要件定義</b>（再作業中＝implementing）<span style="color:#b45309"> ◀ 玉＝AI</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 <span style="background:#ede9fe;border-radius:4px;padding:1px 6px">🤖 Claude</span> / レビュー担当 👤 太郎</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>人間レビュー待ちキュー</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）＝implemented <span style="color:#64748b">（＝二次レビュー。下記注）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">作業者 👤 太郎 / レビュー担当 —（未指名）</td>
  </tr>
</table>

<small>※ 差し戻しで要件定義は `implemented`→`implementing` に戻り、人間レビュー待ちキュー（`implemented` の葉）から抜けて、再びエージェント作業キュー（{ready,implementing}∧作業者＝Claude）に入る（`queues.ts`・actor 非依存導出）。<b>レビュー作業ノードが implemented に達した瞬間、それ自体は人間レビュー待ちキューに入る</b>（導出は actor 非依存ゆえ「入りうる」でなく「入る」）——これは「レビュー作業のレビュー（二次レビュー）」に当たるが、その承認（implemented→accepted）は通常**畳んで**底打ちする（二次レビューをノード化しない＝MODEL §7#18(b)(vii)）。畳みは**提示層の運用**であって導出キューからは消えない（一次＝要件定義のレビューと二次＝レビュー作業のレビューの区別・畳みの表示は presentation の責務・MODEL §2.1）。<b>既知ギャップ：人間が作業中（implementing・作業者＝人間）の作業を映す「人間作業キュー」は現行バックエンドの導出に無い</b>（`agentWorkQueue` は作業者＝エージェント限定）——太郎のレビュー中はノード状態＋ガント（平準化）で可視化。専用キューの要否は提示層/spec の検討事項（別タスク）。</small>

### 4-3. 作業の詳細＋素のデータ（After）

要件定義の行をクリックすると詳細（Inspector）が開き、状態・担当・レビュー担当・予定/実績の日付と EVM（出来高 EV／計画値 PV／実コスト AC）が見える。差し戻し後は出来高 0・実コスト残存・再作業中。要件: moira-surface-schedule Req15／moira-schedule Req13。

**データ（After・素の値）**

| ノード | lifecycle | 見積状態 | 担当（作業者） | レビュー担当 | 出来高 EV_abs 寄与 | 実コスト AC | 実行カバレッジ寄与 |
|---|---|---|---|---|---|---|---|
| └ 要件定義 | implementing（差し戻し・再作業中） | agreed（3人日） | Claude | 太郎 | ❌ 0（未完了＝二値・差し戻しで失う） | 初回作成ぶん残存＋再作業で増（例示） | ✅（`implementing`＝1） |
| └ レビュー作業（要件定義） | implemented（レビュー完了） | agreed（1人日・例示） | 太郎 | —（二次は畳む） | ✅ 1（完了∧合意済み） | レビュー工数（例示） | ❌（`implementing` でない） |
| └ 設計 | pending | agreed（5人日） | —（対象外） | — | ❌ 0 | 0 | ❌ |
| └ タスク | pending | agreed（2人日） | —（対象外） | — | ❌ 0 | 0 | ❌ |

出来高 EV%：**9%**（EV_abs 1〔レビュー作業〕 / 合意済み有効葉の見積総和 3+5+2+1=11。**葉基底＝MD 重み**）<br>
実行カバレッジ：**25%**（`implementing` の合意済み有効葉 1〔要件定義の再作業〕 / 4。**葉基底＝カウント比**。EV% の MD 重みとは次元が違うので混同しない）<br>
見積カバレッジ（P2）：**100%**（合意済み有効葉 4 / 既知の有効葉 4）<br>
人間レビュー待ちキュー：要件定義は抜けた（再作業中）／レビュー作業ノードは implemented で入る（二次レビューは畳む・§4-2 注）

<small>※ <b>実行カバレッジ（カウント比）と EV%（MD 重み）は基底が異なる</b>：実行 25%＝implementing 葉 1/全合意葉 4（本数）、EV% 9%＝EV_abs 1/見積総和 11（人日）。両者を算術で足し引きしない（MODEL R-S8／§3）。差し戻し後、要件定義の出来高 EV は 0（未完了＝二値）だが、初回作成で費やした実コスト AC は事実として残る（コストは事実＝MODEL A6/P6）——「出来高 0 ＋ AC 残存」が「やり直し中（作業は無駄でない）」を正直に表す。詳細パネル（Inspector）の予定終了日＝凍結スロット `frozenSlot`（実在「基準完了日」）、予定開始日・実績開始/終了日は moira-schedule Req13 の per-node 導出（実績終了日は再作業中ゆえ「未」＝honest empty・AC4/Req13 AC3）。参照スライスの Inspector は基準完了日・予測完了日のみ描画、残り日付と reviewer フィールドは未描画＝定義済み要件への目標。</small>

### 4-4. decision インボックス（横断）— レビュー差し戻しは出ない

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#374151;color:#fff"><td style="padding:6px 10px">🗂 decision インボックス（横断）（After）</td></tr>
  <tr>
    <td style="padding:14px 10px;border:1px solid #cbd5e1;color:#64748b;text-align:center">— レビューの差し戻し（再作業要求）はここには出ない。レビューは人間レビュー待ちキュー／ノード状態で扱う。decision インボックスが集約するのは 5 コミット判断のうち 4 つ＋判断要警告で、成果物レビューの差し戻しはそのどれにも含まれない（§7）。 —</td>
  </tr>
</table>

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | ① レビュー作業ノードを立てる `decompose`（F の子・見積 proposed）＋依存辺 `relate`（要件定義 → レビュー作業）、② レビュー作業の見積合意 `transition`（estimate-agreement→agreed）、③ レビュー着手 `transition`（→implementing・作業者 太郎）、④ レビュー完了 `transition`（→implemented・太郎）、⑤ 指摘による差し戻し `transition`（要件定義 →implementing・後退・actor 太郎・理由付き）。件数は実装が決め、下記は主要イベント |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-requirements-returned.md`） | 太郎のレビュー指摘の内容・根拠、「要件定義を差し戻して再作業」という判断、レビュー作業ぶんの出来高獲得 |
| **spec-value 画面 / schedule-time 画面** | レビュー作業が「レビュー中→レビュー完了」で出来高 +1、要件定義が「レビュー待ち→再作業中」へ後退し出来高 0、玉が太郎→AI へ、EV% が 30%→27%→9% と動く（§4） |

```json
[
  {
    "id": "e070", "ts": 70,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "要件定義のレビュー作業をノード化（相応の工数ゆえ EV 計上・MODEL §7#18(b)）",
    "children": [ { "node": "F/review-req", "estimate": 1 } ]
  },
  {
    "id": "e071", "ts": 71,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate",
    "op": "add",
    "from": "F/req",
    "to": "F/review-req",
    "edgeKind": "dependency",
    "policy": "implemented"
  },
  {
    "id": "e072", "ts": 72,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 1,
    "reason": "レビュー工数の見積を合意（AI 提案・人間が確定）"
  },
  {
    "id": "e073", "ts": 73,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "human", "id": "dev:taro" },
    "reason": "太郎が要件定義のレビューを開始（レビュー中）"
  },
  {
    "id": "e074", "ts": 74,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "lifecycle",
    "to": "implemented",
    "reason": "レビュー完了・指摘事項あり（レビュー作業の出来高を獲得）"
  },
  {
    "id": "e075", "ts": 75,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "implementing",
    "assignee": { "kind": "agent", "id": "claude" },
    "reason": "レビュー指摘により差し戻し（再作業）。implemented→implementing の後退＝P5"
  }
]
```

<small>注：ノード ID・ts 値は例示で実装が決める（ID 形は前提ユニット `requirements-spec-drafted` と同じ `F/req` 系の2階層）。**e070/e071**：レビュー作業ノード `F/review-req` を F の子として `decompose` で誕生させ（§2.6 二段 decompose の主語＝F・§7#18(b) でレビュー作業ノードは feature の子）、要件定義 → レビュー作業の依存辺を張る（policy=implemented＝要件定義が implemented でレビューが ready になる；spec フェーズ関連辺の既定 accepted から意図的に逸脱＝レビューは accepted でなく implemented に依存）。レビュー作業ノードは**新概念でなく A1 通常作業ノードの一例**（MODEL §7#18(b)）。誕生直後は未見積葉でカバレッジが一時下がり（§2.3 の発見信号）、**e072** の見積合意（AI 提案・人間確定＝§2.1#1）で 100% に戻る。**Q1（レビュー見積のタイミング）**：AI が「太郎がレビューに入る時点」で工数を提案し人間が合意する（e070→e072）；計画時に前倒し見積してもよい（P0）。**e073** で太郎が着手（→implementing・作業者 assignee=太郎）＝レビュー中、太郎の容量 c で平準化（`leveler.ts` は lifecycle 非依存に assignee≠null∧agreed∧estimated 葉を平準化＝人間 implementing も対象）。**e074** でレビュー完了（→implemented）＝レビュー作業の出来高 1 を獲得（`ev.ts`：`COMPLETED={implemented,accepted}`）。**e075** が差し戻し＝要件定義を `implemented→implementing` へ後退（P5。`reachedImplemented` は true のまま at-risk）。actor は太郎（指摘で戻す人）、assignee=Claude（再作業する側）。レビュー作業ノードの assignee（太郎）は**レビュー担当 reviewer の*指名*属性とは別物**（MODEL §7#18(b)(ii)）。event 型は `moira/backend/src/types.ts` の `DecomposeEvent`/`RelateEvent`/`TransitionEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** レビュー担当（太郎）が要件定義のレビュー作業に着手したとき、**システムは** そのレビュー作業を「作業者＝太郎・状態＝レビュー中」の作業として画面に示さ**なければならない**。
- **WHEN** レビュー作業が完了したとき、**システムは** そのレビュー作業ぶんの出来高を、その合意済み見積分だけ上げ**なければならない**（レビューという作業が出来高を生む）。
- **WHEN** レビュー作業の出来高を計上するとき、**システムは** それを途中段階の部分的な割合では計上**してはならない**（出来高は完了で初めて満額算入する＝二値）。
- **WHEN** レビュー担当が指摘事項により要件定義を差し戻したとき、**システムは** 要件定義を「レビュー待ち（作成完了）」から「再作業中」へ戻さ**なければならない**。
- **WHEN** 要件定義が差し戻されたとき、**システムは** 要件定義ぶんの出来高を失わせ**なければならない**（再作業中は未完了＝出来高 0。途中残しをしない）。
- **WHEN** 要件定義が差し戻されたとき、**システムは** すでに費やした実コストを保持**しなければならない**（コストは事実・出来高 0 でも作業記録は残る）。
- **WHEN** 要件定義が差し戻されたとき、**システムは** 要件定義を人間レビュー待ち一覧から外し、再びエージェントが再作業する側（玉＝AI）に現さ**なければならない**。
- **WHEN** レビュー作業の出来高と要件定義の出来高が同時に動くとき、**システムは** その2つを別々の作業の出来高として区別して示さ**なければならない**（「レビューは進んだ」と「要件定義は差し戻された」が別々に分かる）。
- **WHEN** レビュー担当の*指名*（誰がレビューするか）が画面に出るとき、**システムは** それを出来高・スケジュール・カバレッジを動かさない情報として扱わ**なければならない**（出来高を動かすのはレビュー*作業*であって指名ではない）。
- **WHEN** レビューで差し戻しが起きたとき、**システムは** それを横断の decision 一覧（インボックス）に出**してはならない**（レビューはレビュー一覧／ノード状態で扱う）。
- **WHEN** 開発者が差し戻された作業の詳細を開いたとき、**システムは** 出来高（0）・実コスト（残存）・状態（再作業中）を正直に示さ**なければならない**（出来高を偽装しない）。
- **WHEN** 実行の進み具合（作業中の割合）と達成率（出来高の割合）を示すとき、**システムは** それらを別々の指標として示さ**なければならない**（作業中＝本数の割合、達成率＝出来高〔人日〕の割合で、混ぜて足し引きしない）。

## 7. 決定事項

<!-- 検証ループ（doc-adversary×3 → 3→0 全面書き直し → doc-gate-judge PASS）通過後、ユーザー批准のうえ確定。 -->

- **レビュー作業のノード化＝MODEL v19 §7#18(b):** 太郎のレビューは「通常の A1 作業ノード」としてモデル化し、見積・作業者（太郎）・lifecycle・出来高を持つ（運用タスク・バグ修正と同様に「遂行され出来高を生む作業」＝A1 射程・新概念でない）。本ユニットはレビュー工数を可視化する主眼ゆえノード化を採る。**Q1（レビュー見積のタイミング）**：AI が「太郎がレビューに入る時点」で工数を提案し人間が合意する（前倒し見積も P0 で可）。レビュー見積の値（例 1人日）は例示で実装/運用が決める。出所＝MODEL §2.4／§7#18(b)／§6 来歴（本作業の moira-model-update で確定・commit e7b197a）。
- **差し戻しは要件定義を 3→0 に後退させる（二値・正直な P5 信号）:** 要件定義の `implemented→implementing` は P5 の「到達後の後退＝再作業」の正直な信号（`reachedImplemented` は true のまま at-risk）。出来高は現在状態の導出ゆえ後退し、部分残しをしない（二値・MODEL v16 で部分EV 却下）。**「3→2 のように指摘ぶんだけ減らす」見せ方は本ユニットでは採らない**——それには要件定義を計画時に複数葉へ分解しておく必要があり（差し戻しは指摘された葉だけ後退）、本ユニットの前提（単一ノード）では成立しない。粒度は計画のコミット判断（§2.1#4）で、細粒度版は別ユニットの題材。出所＝MODEL §2.5／P5・参照実装 `ev.ts`。
- **完了後の後付け分割・按分は採らない（敵対ゲートで却下）:** 「差し戻し時に完了ノードを kept＋rework に後付け decompose して EV を按分する（3→2）」案は、moira-model-update の独立敵対ゲート（moira-adversary×3・V1–V6）が **I4 完了施錠・R-E3（完了ノード再見積禁止）・§2.7 supersede・§2.5 lifecycle に抵触し、部分EV（v16 却下）を密輸し、かつ後退遷移を消して P5 の差し戻し信号を自滅させる**として却下。**MODEL 変更は不要**（差し戻しは既存の P5 後退で表現し、粒度は計画時の分解で決める）。出所＝本作業の moira-model-update 敵対ゲート・会話ログ。
- **2つの出来高の分離が主眼:** 差し戻しで要件定義の出来高は 3→0、レビュー作業の出来高は 0→1。EV% は Before 30%→During 27%（レビュー作業1人日を計画に足した希釈）→After 9%（要件定義の差し戻し）と動く。レビュー工数をモデル化しないと見えるのは要件定義の出来高が 0 に落ちたことだけで「レビューは進んだか／何が起きたか」が失われる（MODEL §7#18(b) の UC を解消）。「要件定義 0 でも作業は無駄でない」は (a) レビュー作業 EV、(b) AC 残存、(c) 再作業の安さ（次ユニット）で読める。
- **実行カバレッジ（カウント比）と達成率 EV%（MD 重み）は基底が違う:** 実行カバレッジ＝`implementing` の合意済み有効葉**本数** / 全合意有効葉本数（After 1/4=25%）。達成率 EV%＝EV_abs / 合意済み葉見積総和（After 1/11≈9%）。両者は次元が異なり算術で混ぜない（MODEL R-S8／§3・参照実装 `coverage.ts`）。
- **レビュー作業ノードは implemented で humanReviewQueue に入る（二次レビュー・畳んで底打ち）:** 導出キューは actor 非依存ゆえ、レビュー作業ノードが implemented になると humanReviewQueue に入る（＝レビュー作業のレビュー）。その承認は通常畳んで底打ちする（二次レビューをノード化しない＝MODEL §7#18(b)(vii)）。畳みは提示層の運用で導出からは消えない（一次/二次の区別・畳みの表示は presentation 責務）。
- **「人間作業キュー」は現行バックエンドの導出に無い（既知ギャップ）:** `agentWorkQueue` は作業者＝エージェント限定、`humanReviewQueue` は `implemented` の葉。太郎がレビュー作業中（implementing・作業者＝人間）はどちらの導出キューにも入らず、spec-value のノード状態と schedule の平準化で可視化する。専用の人間作業キューの要否は提示層/spec の検討事項（別タスク）。出所＝参照実装 `queues.ts`。
- **差し戻し後の玉は AI（再作業）:** 差し戻しで要件定義は人間レビュー待ちキューから抜け、再びエージェント作業キュー（{ready,implementing}∧作業者＝Claude）に入る。玉は lifecycle から導出（actor 非依存・`queues.ts`）。MODEL に「玉」という一級概念は新設しない。
- **本ユニットの範囲:** 「太郎がレビュー作業（出来高獲得）→指摘で差し戻し（要件定義の出来高後退・再作業へ）」まで。要件定義の**再作成**（Claude が再実装）と**再レビュー**（次の往復）、人間の**承認**（implemented→accepted・出来高を動かさない品質確認）、レビューで**指摘なし＝承認へ進む**経路、**複数往復**は別ユニット。差し戻しが何度も起きる場合、各往復でレビュー作業ノードが EV を積み、要件定義が P5 後退するので「何回差し戻したか」が見える（複数往復の合成はフロー側＝v1 スコープ外）。
- **参照実装は暫定スライス・各要素は定義済み要件への目標:** レビュー作業ノード行・担当列・レビュー担当列・名前付きキューの一覧描画・人間作業中の可視化・Inspector の予定/実績日・reviewer フィールドのうち、参照スライス（`SpecValueSurface.tsx`/`ScheduleTimeSurface.tsx`/`Inspector.tsx`）未描画のものは「(スライス未描画)」と中立に記した。いずれも MODEL/spec に定義済みの要件（frontmatter トレース）への目標で、現スライス挙動には縛られない。
