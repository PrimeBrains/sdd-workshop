---
id: units/review-work-estimated
title: 計画段階でレビュー作業ノードが立てられ、レビュー工数の見積もりが提案・合意される
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, activity(新規)]
precondition: 新規 spec のフェーズノード（要件定義・設計・タスク）の見積が合意済み（agreed）で、レビュー作業ノードはまだ立てられていない。全ノードが pending（作業は着手前）
postcondition: 各フェーズのレビュー作業ノードが feature の子として追加され、レビュー工数の見積が合意済み（agreed）。見積カバレッジ（P2）は一時的に低下した後 100% に回復
touches_specs:
  - moira-core
  - moira-evm
  - moira-surface-spec-value
touches_requirements:
  - "moira-core: 3.1, 3.2, 3.3, 4.1, 4.2, 6.4, 6.6, 7.1, 7.2"
  - "moira-evm: 3.1, 3.3"
  - "moira-surface-spec-value: 1.1, 4.1, 4.3, 7.1"
---

# 計画段階でレビュー作業ノードが立てられ、レビュー工数の見積もりが提案・合意される

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

計画段階（作業着手前）に、フェーズの見積もりと並べて**レビュー作業の見積もりが提示**され、人間の議論・合意を経て agreed になること。中核は：

- レビュー作業ノードが feature の子として追加されること（MODEL §7#18(b)・A1 の通常作業ノード）
- レビュー工数の見積が proposed で提示され、人間の合意で agreed になること
- P2（見積カバレッジ）が一時的に低下してから回復すること（§2.3 の発見信号）
- レビュー工数の見積もり・合意は、レビュー担当の指名（reviewer 属性）とは別物であること

## 2. 前提（Given）

新規 spec `F` のフェーズノード（要件定義・設計・タスク）の見積が**合意済み（agreed）**で、レビュー作業ノードはまだ立てられていない。全ノードが pending（作業は着手前）。

| ノード | 見積状態 | 見積値 | 凍結値 | lifecycle |
|---|---|---|---|---|
| F（フィーチャー） | — | — | — | pending |
| └ 要件定義 | agreed（承認済み） | 3人日 | 3 | pending |
| └ 設計 | agreed（承認済み） | 5人日 | 5 | pending |
| └ タスク | agreed（承認済み） | 2人日 | 2 | pending |

見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 3 / 既知の有効葉 3）<br>
レビュー担当（reviewer）：**未指名**（本ユニットは reviewer の指名を扱わない。指名済み・未指名いずれでも本ユニットの振る舞いは変わらない＝§7）

## 3. ふるまい（When / Then）

```
When  新規 spec のフェーズノード（要件定義・設計・タスク）の見積もりを依頼する段階で、
      AI がフェーズの見積案（要件定義 3人日・設計 5人日・タスク 2人日）と並べて、
      各フェーズのレビュー作業ノードも子ノードとして計画に立て、
      レビュー工数の見積案を提示する（この時点では提案中＝未承認）。
Then  フェーズの見積案に加えて、レビュー作業の見積案
      （例: 要件定義レビュー 1人日）が「提案中（未承認）」として現れる。
And   人間がレビュー工数の見積案に対して議論し
      （「要件のレビューはこのくらいかかりそう」「ここは軽いから少なめで」等）、
      合意に至ると見積もりが「合意済み」になる。
And   合意済みになった時点で、レビュー作業ノードが見積もり済みとして数えられ、
      （新規ノードの追加で一時的に下がっていた）見積もり済みの割合（カバレッジ）が回復する。
And   実際のレビュー開始時に、出来上がったものを見て「想定より重い」と感じた場合、
      見積もりを修正（再見積もり）する経路がある。
      ◀ boundary: 再見積もりの具体的なふるまいは本ユニットの対象外（別ユニット）。
And   このレビュー工数の見積もり・合意は、レビュー担当の指名（誰がレビューするか）
      とは別物である。
```

<small>注：「レビュー作業ノード」は MODEL §7#18(b) の A1 通常作業ノードの一例（新概念でない）。レビュー担当の指名（reviewer 属性・MODEL §2.4/§7#18(a)）は本ユニットでは行わない（別のタイミング・別のユニットの責務）。「見積もりを依頼する段階」は計画段階全体を指す（§7）。見積案の提示 write は `moira-estimate-propose`（仮称・⚠未実装）、合意の write は `moira-estimate-agree`（⚠未実装）が担う（spec-value 画面は合意を自ら実行せず、合意 write 文脈への深リンクのみを提供する＝moira-surface-spec-value Req7）。</small>

## 4. 画面の変化（Before → During → After）

採用表現は **spec-value 中心**（前段ユニット §7 決定を継承）。

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — フェーズ見積 合意済み・レビュー作業なし）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>100%</b>（3/3・葉基底）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 3人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 5人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日 ／ EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（During — レビュー作業ノード追加・提案中）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>50%</b>（3/6・葉基底）<br><span style="color:#dc2626">⚠ カバレッジ低下（新規ノード発見）</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 3人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 5人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 要件定義レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 1人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ 設計レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 1人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1;background:#fffbeb">└ タスクレビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#fde68a;border-radius:4px;padding:1px 6px">提案中（未承認）</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#fffbeb">見積 0.5人日 ／ EV寄与 0</td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — レビュー工数 合意済み）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積カバレッジ <b>100%</b>（6/6・葉基底）<br><span style="color:#16a34a">葉は全て合意済み</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 3人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 5人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 2人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 1人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計レビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 1人日 ／ EV寄与 0</td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスクレビュー</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">承認済み</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">見積 0.5人日 ／ EV寄与 0</td>
  </tr>
</table>

### 履歴画面（activity・新規サーフェス）

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="2" style="padding:6px 10px">🕓 履歴画面（activity・新規）（After）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">たった今</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">太郎が <b>レビュー作業の見積案を承認</b>（要件定義レビュー 1人日 / 設計レビュー 1人日 / タスクレビュー 0.5人日・<span style="color:#16a34a">承認済み</span>）</td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;white-space:nowrap">先ほど</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">Claude が <b>レビュー作業ノードの追加と見積案</b> を提示（要件定義レビュー 1人日 / 設計レビュー 1人日 / タスクレビュー 0.5人日・<span style="color:#b45309">未承認</span>）</td>
  </tr>
</table>

**データ（During — レビュー作業ノード追加・提案中・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | 分母外（中間ノード） |
| └ 要件定義 | pending | agreed | 3人日 | 3 | ✅ 分子・分母とも算入 |
| └ 設計 | pending | agreed | 5人日 | 5 | ✅ 分子・分母とも算入 |
| └ タスク | pending | agreed | 2人日 | 2 | ✅ 分子・分母とも算入 |
| └ 要件定義レビュー | pending | proposed | 1人日 | — | ❌ 分母のみ算入（未合意） |
| └ 設計レビュー | pending | proposed | 1人日 | — | ❌ 分母のみ算入（未合意） |
| └ タスクレビュー | pending | proposed | 0.5人日 | — | ❌ 分母のみ算入（未合意） |

見積カバレッジ（P2・葉基底）：**50%**（合意済み有効葉 3 / 既知の有効葉 6）<br>
凍結済み合計：**10人日**（3 + 5 + 2）／提案中レビュー工数合計：**2.5人日**（1 + 1 + 0.5）

**データ（After — レビュー工数 合意済み・素の値）**

| ノード | lifecycle | 見積状態 | 見積値 | 凍結値 | P2 への算入 |
|---|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | — | 分母外（中間ノード） |
| └ 要件定義 | pending | agreed | 3人日 | 3 | ✅ 分子・分母とも算入 |
| └ 設計 | pending | agreed | 5人日 | 5 | ✅ 分子・分母とも算入 |
| └ タスク | pending | agreed | 2人日 | 2 | ✅ 分子・分母とも算入 |
| └ 要件定義レビュー | pending | agreed | 1人日 | 1 | ✅ 分子・分母とも算入 |
| └ 設計レビュー | pending | agreed | 1人日 | 1 | ✅ 分子・分母とも算入 |
| └ タスクレビュー | pending | agreed | 0.5人日 | 0.5 | ✅ 分子・分母とも算入 |

見積カバレッジ（P2・葉基底）：**100%**（合意済み有効葉 6 / 既知の有効葉 6）<br>
凍結済み合計：**12.5人日**（10 + 1 + 1 + 0.5）

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | decompose **1件** + relate **3件** + transition **3件** ＝計 **7件** 追記（下記 JSON） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-review-work-estimated.md`） | 提示した案・議論・合意判断の記録 |
| **履歴画面（新規）** | 「レビュー作業ノード追加・見積案提示」「レビュー見積を承認」の 2 行（§4） |

### イベント：レビュー作業ノードの追加と見積提示（AI）

```json
[
  {
    "id": "e040", "ts": 40,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "decompose",
    "parent": "F",
    "reason": "各フェーズのレビュー作業ノードを追加し、レビュー工数の見積を提案（未承認）",
    "children": [
      { "node": "F/review-req", "estimate": 1 },
      { "node": "F/review-design", "estimate": 1 },
      { "node": "F/review-tasks", "estimate": 0.5 }
    ]
  },
  {
    "id": "e041", "ts": 41,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate",
    "op": "add",
    "from": "F/req",
    "to": "F/review-req",
    "edgeKind": "dependency",
    "policy": "implemented"
  },
  {
    "id": "e042", "ts": 42,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate",
    "op": "add",
    "from": "F/design",
    "to": "F/review-design",
    "edgeKind": "dependency",
    "policy": "implemented"
  },
  {
    "id": "e043", "ts": 43,
    "actor": { "kind": "agent", "id": "claude" },
    "kind": "relate",
    "op": "add",
    "from": "F/tasks",
    "to": "F/review-tasks",
    "edgeKind": "dependency",
    "policy": "implemented"
  }
]
```

<small>注：ノード ID・ts 値は例示で実装が決める。**e040**：レビュー作業ノード 3 件を F の子として `decompose` で追加し、見積案を提示する。新規子の誕生と見積の設定を 1 件の `decompose` で行う（MODEL §2.8「ノードの子と見積を設定/改訂」）。**見積値は proposed 状態で記録され**、人間の合意 transition（e044–e046）で agreed に変わる（前段 `estimate-spec-proposed` が既存子に見積を載せるのに対し、本ユニットは新規子を誕生させつつ見積を載せる——いずれも同一イベント種別 `decompose`）。レビュー作業ノードは feature の子（§2.6・§7#18(b)）で A1 の通常作業ノードの一例。**e041–e043**：各フェーズノード → レビュー作業ノードの依存辺を張る（`policy=implemented`＝フェーズが `implemented` に達してレビューが `ready` になる。spec フェーズ辺の既定 `accepted` から意図的に逸脱＝§7）。event 型は `moira/backend/src/types.ts` の `DecomposeEvent`・`RelateEvent` に一致。</small>

### イベント：レビュー工数の合意（人間）

```json
[
  {
    "id": "e044", "ts": 44,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 1
  },
  {
    "id": "e045", "ts": 45,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 1
  },
  {
    "id": "e046", "ts": 46,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-tasks",
    "machine": "estimate-agreement",
    "to": "agreed",
    "frozenBudget": 0.5
  }
]
```

<small>注：**e044–e046**：人間（太郎）がレビュー工数の見積案を承認し `proposed→agreed` に遷移。`machine: "estimate-agreement"` は lifecycle とは独立した見積合意の状態機械（MODEL §2.2）。`actor.kind` が `"human"` であること（MODEL I6・R-U4）および `frozenBudget` の記録（MODEL §3・R-U7）は不変条件。承認操作は `moira-estimate-agree`（⚠未実装）write 文脈で人間が行う。event 型は `moira/backend/src/types.ts` の `TransitionEvent` に一致。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 計画段階で AI がレビュー作業ノードを追加したとき、**システムは** 各フェーズに対応するレビュー作業ノードを feature の子として作成し、レビュー工数の見積案を「提案中（未承認）」として記録**しなければならない**。
- **WHEN** レビュー作業ノードが追加されたとき、**システムは** 各レビュー作業ノードから対応するフェーズノードへの依存辺（フェーズが完了するとレビューが着手可能になる）を張ら**なければならない**。
- **WHEN** レビュー工数の見積案が提示されたとき、**システムは** spec-value 上のレビュー作業ノードに「未承認」を示す印を付け**なければならない**。
- **WHEN** レビュー作業ノードが追加されたとき、**システムは** 見積カバレッジの分母に新規ノードを算入し、カバレッジの低下を正直に示さ**なければならない**（新規作業の発見信号）。
- **WHEN** 開発者がレビュー工数の見積案を承認したとき、**システムは** 見積を「合意済み」として記録し、凍結値を確定**しなければならない**。
- **WHEN** レビュー工数の見積が合意されたとき、**システムは** 見積カバレッジの分子にレビュー作業ノードを算入し、カバレッジを回復させ**なければならない**。
- **WHILE** 人間が承認していない間、**システムは** レビュー工数の見積を「合意済み」に変更**してはならない**。
- **WHEN** レビュー作業ノードが追加されたとき、**システムは** フェーズノード（要件定義・設計・タスク）の見積状態・凍結値を変更**してはならない**。
- **WHEN** レビュー工数の見積を提示・合意するとき、**システムは** レビュー担当の指名（reviewer 属性）を変更**してはならない**（見積とは別物）。

## 7. 決定事項

- **タイミング＝計画段階（作業着手前）に見積もる:** レビュー工数の見積もりは、フェーズの見積もりと同じ計画段階で行う。「要件定義が完了してからレビュー工数を見積もる」のではなく、作業着手前にレビューまで含めて計画する。実際のレビュー開始時に出来上がったものを見て再見積もりする経路は MODEL R-E3（incomplete ノードの再見積）として存在するが、本ユニットの対象外（別ユニット）。出所＝ユーザー確認（「もっと早い段階で、要件に入る前のタイミングで、レビューまで含めて見積もりをしておくべき」）。
- **前提はフェーズ見積合意後（estimate-spec-agreed の後）:** 本ユニットの前提はフェーズ見積が合意済みであるが、§3 の「見積もりを依頼する段階」は計画段階全体を指す。レビュー作業ノードの追加はフェーズ見積の提案時（estimate-spec-proposed と同時）でも合意後でも可能であり、本ユニットは合意後を前提とすることで **P2 の低下と回復**（§2.3 の発見信号）を明瞭に示す。
- **P2 の動き（分母は追加時・分子は合意時）と §3 表現の精緻化:** P2 の正確な定義（MODEL v18・葉基底）では、レビュー作業ノードが追加された（proposed）時点で**分母（既知の有効葉）**が 3→6 に増え P2 は 100%→50% に低下し（§2.3 の発見信号）、人間が合意すると**分子（合意済み有効葉）**が 3→6 に増え P2 は 100% に回復する。§3 は当初この回復を「合意済みになった時点で分母に入る」と転記していたが、分母には proposed 時点で既に入る（合意で入るのは分子）ため、人間意図（合意でカバレッジが回復する）を保ったまま「見積もり済みとして数えられ…カバレッジが回復する」へ精緻化した（人間意図の不変・技術的不正確さの是正）。§4 データ表が正確な数理を示す。
- **3フェーズ分のレビュー作業ノードを一括追加:** 計画段階で各フェーズ（要件定義・設計・タスク）に対応するレビュー作業ノードを一括で追加する。要件定義だけ先にレビュー工数を立てるのではなく、計画の全体像としてレビュー工数を提示する。レビュー工数の値（例: 要件定義 1人日・設計 1人日・タスク 0.5人日）は例示であり、実装/運用が決める。
- **レビュー見積とレビュー担当指名は別物（reviewer は前提で未指名）:** レビュー工数の見積もり（本ユニット）と、レビュー担当の指名（reviewer 属性＝MODEL §2.4/§7#18(a)・moira-core Req6 AC4/AC6）は別の行為。本ユニットではレビュー担当の指名は行わず、前提では reviewer は**未指名**（§2）。reviewer は計画/会計の導出（平準化・EV・PV・カバレッジ）に一切参加しない付帯属性ゆえ、指名済み・未指名いずれでも本ユニットの見積・カバレッジの振る舞いは変わらない（moira-core Req6 AC6）。出所＝MODEL §7#18(b)(ii)（assignee は reviewer 属性の指名とは独立）。
- **レビュー作業ノードの依存辺は `policy=implemented`（spec フェーズ辺の既定 `accepted` から意図的逸脱）:** 各フェーズノード → レビュー作業ノードの依存辺は `policy=implemented`（フェーズが作成完了＝`implemented` に達した時点でレビュー作業が `ready` になる）とする。spec フェーズ間辺の既定 `accepted`（MODEL R-D2）とは異なり、レビューは承認前の作成完了物に対して着手できるという設計判断。3 フェーズ分の辺を計画段階で同時に決めるため §7 に明示する。出所＝MODEL §2.6/R-D2（同じ `policy=implemented` の依存辺は requirements-spec-returned でも前提として用いられる）。
- **承認 write の所有は `moira-estimate-agree`（⚠未実装）・提示 write は `moira-estimate-propose`（仮称・⚠未実装）:** 見積案の提示（proposed 記録）と合意（`proposed→agreed`）はいずれも独立 write skill が所有し、spec-value 画面は合意を自ら実行せず write 文脈への深リンクのみを提供する（出所＝moira-surface-spec-value Req7・前段 estimate-spec-agreed §7 と同型）。
- **スコープ＝happy path（計画段階での一括提示→一括合意）に限定:** 本ユニットは「AI がレビュー工数の見積案を提示 → 人間が議論 → 一括合意」の経路のみを扱う。**計画段階での見積拒否（proposed のまま合意しない／値の修正を求める差し戻し）**・**部分合意（ノード単位合意）**・**実レビュー開始時の再見積（R-E3）**は、それぞれ別ユニットとして切り出す（前段 estimate-spec-agreed §7 と同じ FORK 方針）。§3 は不可侵の人間意図であり、これらの否定系・部分系をここに混入させない。
- **トレース先 moira-evm Req3.1 の文言陳腐は別タスク（本ユニットは正典 P2 に接地）:** 本ユニットがトレースする moira-evm Req3 AC1 は「有効**ノード**数 ÷ 既知の有効**ノード**総数」と記述しており、MODEL v18 の葉基底 P2（`|合意済み有効葉|/|既知の有効葉|`）に未同期の陳腐表記がある。本ユニットの数理は MODEL v18 正典（葉基底）に接地して正しく、moira-evm spec 文言の v18 同期は MODEL §7#17(d) と同様に別タスク（本ユニットは MODEL 正典を SSOT とする）。
- **requirements-spec-returned.md との関係（同期済み）:** 旧 requirements-spec-returned は「太郎がレビューに入る時点」でレビュー作業ノードを立てる経路（旧 e070–e072）を含んでいたが、本ユニットの agreed を承け **2026-06-26 に同期済み**——レビュー作業ノードの誕生・依存辺・見積合意を**前提（計画段階で実施済み＝本ユニットの e040–e046）**へ移し、requirements-spec-returned は計画済みレビュー作業ノードの**実行**（着手→完了→差し戻し・e073–e075）のみを扱う形に改めた。これに伴い同ユニットの Before 出来高 EV% は 30%→27% へ是正された。なお estimate-spec-agreed 以降の他ユニット（requirements-spec-drafted・assign-spec-provisional 等）の Before/木へのレビューノード反映は follow-up（別タスク）。
