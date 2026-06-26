---
id: units/assign-spec-provisional
title: spec の作業に担当を付ける（システムは自動割当しない）
status: agreed
language: ja
actor: 開発者
surfaces: [spec-value, schedule-time]
precondition: 見積が合意済みの全作業ノード（要件定義・設計・タスク＋各レビュー作業）が存在し、まだ誰にも割り当てられていない（レビュー作業ノードは計画段階で追加・見積合意済み＝ユニット review-work-estimated の後）
postcondition: フェーズノードに担当者が付き、担当が付いた行は未割当バックログから外れる
touches_specs:
  - moira-core
  - moira-surface-spec-value
  - moira-schedule
touches_requirements:
  - "moira-core: 3.1, 5.1, 6.1, 6.2, 6.3"
  - "moira-surface-spec-value: 1.1"
  - "moira-schedule: 3.1, 3.2"
---

# spec の作業に担当を付ける（システムは自動割当しない）

> 読み方：開発者は §1〜§4 を見れば妥当性を判断できます。内部表現の正しさは moira 専門家エージェントが確認します。

## 1. このユニットで確かめること

見積が合意済みの spec に対し、Claude が担当候補を推薦し、**人間が自分で選んで担当を付ける**こと（作業はまだ着手前＝計画として先に置く）。システムが勝手に割り当てないこと。担当が付いた行は未割当バックログから外れ、あとから変更できること。

## 2. 前提（Given）

新規 spec `F` の全作業ノード（要件定義・設計・タスク＋各レビュー作業）に見積が合意済みで、まだ誰にも割り当てられていない。レビュー作業ノードは計画段階で追加・見積合意済み（ユニット review-work-estimated の後）。

| ノード | 見積状態 | 見積値 | 担当 |
|---|---|---|---|
| F（フィーチャー） | — | — | なし |
| └ 要件定義 | agreed | 3人日 | なし |
| └ レビュー作業（要件定義） | agreed | 1人日 | なし |
| └ 設計 | agreed | 5人日 | なし |
| └ レビュー作業（設計） | agreed | 1人日 | なし |
| └ タスク | agreed | 2人日 | なし |
| └ レビュー作業（タスク） | agreed | 0.5人日 | なし |

未割当バックログ：**6 件**（合意済み有効葉のうち被割当者なし）

## 3. ふるまい（When / Then）

```
When  見積案が出そろった spec について、担当を決める段に入る（見積skill のパスの中で尋ねられる）。
Then  システムが勝手に担当者を決めることはせず、Claude が
      「この作業（要件定義・設計・タスク＋各レビュー作業）の担当を誰にしますか？」と人間に尋ねる。
And   この spec を進めている開発者（例：ディスカバリを始めた人）が分かっていれば、その人を「おすすめ」として提示する。
      ただし最終的に選ぶのは人間。
And   人間が担当者を選ぶと、その人が担当として記録される。
And   担当が付いた行は未割当バックログから外れ、予定（スケジュール）に載るようになる。
And   担当はあとから変更できる（あとで指名し直せば置き換わる）。
And   開発者は画面を見て、「どの作業に誰が就いたか」「まだ未割当のものはどれか」が一目で分かる。
```

<small>注：「見積skill」の実体は `moira-estimate-propose`（仮称・⚠未実装）で、見積案の提示と同じパスで担当も尋ねる。割当の自動化をしない方針は MODEL §2.1（割当は人間が決めるコミット判断）に対応。§3 の「見積案が出そろった」は見積の提案と合意が完了した状態を指す（合意は同一スキルパス内で見積提案に続けて行われる）。</small>

## 4. 画面の変化（Before → After）

### spec-value 画面

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（Before — 未割当）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#1e3a8a;color:#fff"><td colspan="4" style="padding:6px 10px">🌳 spec-value 画面（After — 担当割当済み）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><b>F（フィーチャー）</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">—</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ 設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px 6px 28px;border:1px solid #cbd5e1">└ レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#bbf7d0;border-radius:4px;padding:1px 6px">agreed</span> 0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#e2e8f0;border-radius:4px;padding:1px 6px">pending</span></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="background:#dbeafe;border-radius:4px;padding:1px 6px">👤 太郎</span></td>
  </tr>
</table>

### schedule-time 画面 — 未割当バックログ

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 未割当バックログ（Before）</td></tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">要件定義</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">3人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（要件定義）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">設計</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（設計）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">1人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">タスク</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">2人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
  <tr style="background:#f8fafc">
    <td style="padding:6px 10px;border:1px solid #cbd5e1">レビュー作業（タスク）</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1">0.5人日</td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1"><span style="color:#dc2626">担当なし</span></td>
  </tr>
</table>

<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:13px;width:100%;margin-top:10px">
  <tr style="background:#374151;color:#fff"><td colspan="3" style="padding:6px 10px">📋 未割当バックログ（After）</td></tr>
  <tr>
    <td colspan="3" style="padding:20px;border:1px solid #cbd5e1;color:#16a34a;text-align:center">✅ 未割当の作業はありません</td>
  </tr>
</table>

**データ（After・素の値）**

| ノード | lifecycle | estimate | 見積値 | 担当 |
|---|---|---|---|---|
| F（フィーチャー） | pending | — | — | なし |
| └ 要件定義 | pending | agreed | 3人日 | 太郎 |
| └ レビュー作業（要件定義） | pending | agreed | 1人日 | 太郎 |
| └ 設計 | pending | agreed | 5人日 | 太郎 |
| └ レビュー作業（設計） | pending | agreed | 1人日 | 太郎 |
| └ タスク | pending | agreed | 2人日 | 太郎 |
| └ レビュー作業（タスク） | pending | agreed | 0.5人日 | 太郎 |

未割当バックログ：**0 件**（割当前 6 件 → 割当後 0 件）

## 5. 出力されるログ（どこに・何が）

| どこに | 何が |
|---|---|
| **プロジェクトの記録**（イベントログ：`moira/backend` のイベントストア） | transition イベントが **6 件**追記される（フェーズ 3 葉＋レビュー作業 3 葉。下記 JSON） |
| **会話ログ**（`.kiro/specs/F/conversations/{日付}-assign-provisional.md`） | Claude の推薦・人間の選択・割当記録 |
| **spec-value 画面** | 各ノードに「太郎」の担当バッジが出現（§4） |

```json
[
  {
    "id": "e050", "ts": 50,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/req",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  },
  {
    "id": "e051", "ts": 51,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/design",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  },
  {
    "id": "e052", "ts": 52,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/tasks",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  },
  {
    "id": "e053", "ts": 53,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-req",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  },
  {
    "id": "e054", "ts": 54,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-design",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  },
  {
    "id": "e055", "ts": 55,
    "actor": { "kind": "human", "id": "dev:taro" },
    "kind": "transition",
    "node": "F/review-tasks",
    "machine": "lifecycle",
    "to": "pending",
    "assignee": { "kind": "human", "id": "dev:taro" }
  }
]
```

<small>注：この担当（着手前の割当。MODEL では「暫定割当」と呼ぶが、データは通常の担当と同じ `assignee` 属性）は lifecycle `transition` の `assignee` 属性として記録される（第5イベント不要）。ライフサイクル状態は `pending` のまま（自己遷移）。ノード ID・ts 値はいずれも例示であり、実装が決める。見積の合意（`estimate-agreement` 機械の `proposed→agreed`）は同一スキルパス内の先行ステップで既に完了しており、本ユニットの §5 には含めない。</small>

## 6. 受け入れ条件（EARS）

- **WHEN** 担当を決める段に入ったとき、**システムは** 担当者を自動で決めず、人間に「誰にしますか？」と尋ね**なければならない**。
- **WHEN** この spec を進めている開発者が特定できるとき、**システムは** その人を「おすすめ」として提示**しなければならない**。ただし最終選択は人間が行う。
- **WHEN** 人間が担当者を選んだとき、**システムは** その人を担当として記録**しなければならない**。
- **WHEN** 担当が記録されたとき、**システムは** その行を未割当バックログから外し、予定（スケジュール）に載せ**なければならない**。<br><small>（未割当バックログ＝合意済みの有効葉のうち被割当者がないもの）</small>
- **WHEN** 担当を変更するとき、**システムは** 前の担当を上書きし（追加ではなく置き換え）、変更履歴を残さ**なければならない**。
- **WHEN** 担当が付いた行が画面に表示されるとき、**システムは**「誰が就いたか」を一目で分かるように示さ**なければならない**。

## 7. 決定事項

- **「おすすめ」の特定方法:** ディスカバリーを始めた人を推薦候補にするが、その特定方法（git user / セッション情報 / e001 の actor 等）は**実装設計に委ねる**（本ユニットは特定方法を規定しない）。
- **担当変更は latest-wins 置換:** 一タスク一担当（MODEL R-T5）。新しい `transition` に `assignee` を載せて追記すれば、前任を置換する。追加ではない。
- **【解決済 / MODEL v17】暫定割当の状態保持遷移:** §5 の transition イベントは lifecycle 状態を `pending` のまま `assignee` を設定する。これは MODEL v17 で**正典化された**——assignee は状態機械の一部でない**付帯記録**（§2.8）ゆえ、状態を保つ `transition`（to=現状態）に載せてよく、**状態機械に辺を足さない**（イベント側の事実）。根拠は §2.8 の付帯記録性であって I5 ではない。暫定割当は未割当バックログから外すが、スロット凍結は §3 の P0 選択（早期凍結 or 着手時）。なお割当の解除（未割当への差し戻し）の符号化は MODEL §7#16 の開示事項。（裁定: `moira-model-update` v16→v17、独立採点者 PASS。）
- **本ユニットはレビュー作業ノード追加後（review-work-estimated の後）を描き、6 葉に暫定割当する:** レビュー作業ノードも「遂行され担当が付く通常作業ノード」（MODEL §7#18(b)・A1）ゆえ、担当割当の対象に含める。本ユニットの断面は計画段階でレビュー作業 3 葉が追加・見積合意済み（ユニット `review-work-estimated`）の後とし、**6 葉すべて**（フェーズ 3＋レビュー作業 3）に暫定割当（太郎）が付く（未割当バックログ 6 → 0 件）。レビュー作業の作業者が太郎である点は `requirements-spec-returned`（太郎がレビューを遂行）と整合。**レビュー担当（reviewer）の指名は本ユニットの対象外**——本ユニットは担当（assignee）のみを扱い、reviewer 属性（誰がレビューするかの指名・出来高/平準化を動かさない付帯属性）は別ユニットの責務（MODEL §7#18(a)・moira-core Req6 AC4-6）。旧版は本ユニットを「位置独立ゆえフェーズ 3 葉のみ描く」としていた（`review-work-estimated` §7 の旧整理）が、レビュー工数の可視化に揃えて **6 葉描画へ同期**した（出所＝本会話 2026-06-27）。
