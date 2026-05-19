# Review Trigger Detection Rules

> `/kiro-postmortem-review` の起動トリガー (R9.5) を判定し、AI が能動的に起動提案を出すためのロジック。
> `/kiro-postmortem-add` 完了直後および通常会話の特定イベント時に評価する。
>
> **重要**: AI は本ルールに該当しても、ユーザー確認なしに `/kiro-postmortem-review` を自動起動しない (R9.3, R9.6)。提案フォーマット (本文末尾参照) で 1 行表示するのみ。

---

## 4 つのトリガー条件 (R9.5)

| ID | Trigger | 検出契機 | 自動提案対象 |
|---|---|---|---|
| (a) | `spec-completion` | `/kiro-impl <feature>` 完了直後 (該当 spec の tasks がすべて `[x]` になった時点) | ✅ AI が提案 |
| (b) | `cluster-threshold` | 未レビューエントリ内で同じ `根本要因分類` ラベルまたは同じ `要因分類` ラベルが 2 件以上に達した時点 | ✅ AI が提案 |
| (c) | `new-spec-init` | `/kiro-spec-init <新 spec>` で新規 spec を開始する直前 | ✅ AI が提案 |
| (d) | `user-explicit` | ユーザーが「振り返りしたい」「レビューして」等を明示要求した時点 | ❌ AI は提案不要 (ユーザーが直接起動) |

(d) は他トリガー条件成立の有無に関わらず常に許容される (R9.7)。

---

## 判定ロジック (擬似コード)

```python
def detect_review_triggers(ledger, session_context) -> list[str]:
    """
    /kiro-postmortem-add 完了直後 or AI 応答生成時に評価する。
    返り値の triggers が空でなければ AI は起動提案を出す。
    """
    triggers = []

    # (a) /kiro-impl 完了直後
    # 検出方法: session_context.just_completed_command が "/kiro-impl"
    #   または会話直近で tasks.md の全 [x] チェックを観測した
    if session_context.just_completed == "/kiro-impl":
        triggers.append("spec-completion")

    # (b) 同 根本要因分類 / 同 要因分類 が未レビューで 2 件以上
    unreviewed = [e for e in ledger.entries if e.status == "recorded"]
    root_cause_counts = Counter(e.root_cause_category for e in unreviewed)
    cause_counts = Counter(e.cause_category for e in unreviewed)
    if any(c >= 2 for c in root_cause_counts.values()):
        triggers.append("cluster-threshold")
    elif any(c >= 2 for c in cause_counts.values()):
        triggers.append("cluster-threshold")

    # (c) /kiro-spec-init 直前
    # 検出方法: ユーザーが /kiro-spec-init を打とうとしている / 直前に予告した
    if session_context.about_to_invoke == "/kiro-spec-init":
        triggers.append("new-spec-init")

    return triggers
```

---

## AI 提案フォーマット (R9.6)

トリガー検出時、AI は **1 行で** 以下フォーマットで提案する。複数提案を縦に並べない。

```
/kiro-postmortem-review を起動しますか？ 未レビュー X 件・該当トリガー: {triggers}
```

### 具体例

```
/kiro-postmortem-review を起動しますか？ 未レビュー 5 件・該当トリガー: spec-completion + cluster-threshold (assumption-error が 3 件)
```

```
/kiro-postmortem-review を起動しますか？ 未レビュー 2 件・該当トリガー: new-spec-init (defect-pdca 開始予定)
```

---

## ユーザー応答パターン

| ユーザー応答 | AI の振る舞い |
|---|---|
| `はい` / `yes` / `起動して` | ユーザーが `/kiro-postmortem-review` を打つまで待つ (skill は disable-model-invocation の可能性があるため AI が直接起動はしない) |
| `あとで` / `後で` / `スキップ` | AI は本セッション内で同トリガーの再提案を控える |
| (無視 / 別話題) | AI は次の自然なタイミングで再評価。連続再提案は避ける |

---

## 注意事項

- 本ルールは **提案** であり、ユーザーが最終判断する (R9.3)
- 同トリガー条件で連続して提案するとノイズになる → セッション中 1 回提案して却下されたら、明確に状況が変化するまで再提案しない
- `(d) user-explicit` はトリガーリストに含めない (ユーザーが直接起動するため AI 提案は不要)
- AI は `.kiro/postmortem/defects.md` を Read してから cluster-threshold を判定する (頻度集計は ledger を読まないとできない)
