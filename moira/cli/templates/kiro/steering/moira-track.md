# Moira トラッキング規約（cc-sdd → Moira アダプタ）

> **managed file**: この文書は `moira adapter install` が設置する配布物（正本は sdd-workshop
> `moira/cli/templates/`）。手で編集すると次回 install で skip される（`moira adapter status` 参照）。

このプロジェクトには cc-sdd → Moira アダプタがインストールされている。
**cc-sdd の各フェーズの節目で、必ず `/moira-track <phase>` を呼んで Moira に記録すること。**
これが「kiro を回すだけで Moira が埋まる」体験の要。マッピングと emit の詳細は
`.claude/skills/moira-track/`（SKILL.md / reference.md）が持つ。

## 発火トリガー（これを見たら必ず打つ・発火漏れ防止）

打鍵は **Claude の責務**（ユーザーは叩かない）。次の「きっかけ」を見たら、対応する発火を**飛ばさない**:

| きっかけ（トリガー） | 必ず発火するもの | 柵 |
|---|---|---|
| cc-sdd の節目に到達（下の対応表の各行） | 対応する `/moira-track <phase>` | 🔔 moira-fire hook が `.kiro/specs/**` の編集を検知して助言 |
| セッション開始時に **Moira drift 検知**が注入された | `/moira-track sync`（.kiro との突き合わせ・追いつき） | 🔔 moira-fire hook（SessionStart） |
| `moira add` を打つ | **必ず `--parent <正しい親>`**（省略は root 二重辺＝issue #5） | 🔒 moira-guard hook が deny |
| ノードを **start する前** | **着手ゲート**: 見積 agreed＋担当＋着手予定日(slot) を確認。未充足なら 見積合意 → `moira assign --slot` を先に | 🔔 moira-guard hook |
| `moira assign` を打つ | assign は lifecycle を **ready へ戻す**。**完了済み(accepted 等)に assign しない**・baseline は着手前 | 🔔 moira-guard hook |
| ノードを **done した直後** | **AC 記録**: `moira cost <node> <実工数md>`（実測・捏造しない・累積加算） | 🔔 moira-guard hook |
| moira に **イベントを追記した後** | 稼働中の `moira ui` に**自動反映**される（見えなければブラウザをリロード・再起動不要） | 🔔 moira-guard hook |
| **5 人間判断**に触れる（見積合意・割当・容量・スコープ・見積深さ） | emit 前に**人間へ確認**（`moira agree` は human 記録＝無断 AI 実行は人間の確約を偽装。`--actor agent:*` は fold が拒否） | — |

> 🔒 = `.claude/hooks/moira-guard.mjs` が **deny で強制**（`--parent` 無し add の1件のみ）／
> 🔔 = additionalContext で**助言**（無視可能ゆえ正しさの最終責任はスキル側。hooks はセーフティネット）。
> 発火の中身（正しいイベント列・着手ゲート/AC の判定手順・sync の突き合わせ）は `moira-track` スキルが持つ。

## cc-sdd の節目 → 発火の対応表

| cc-sdd の節目 | 呼ぶもの |
|---|---|
| `/kiro-discovery` 完了（brief.md） | `/moira-track discovery --feature <name>` |
| spec 着手前に見積を決めた | `/moira-track estimate --feature <name>` |
| `/kiro-spec-requirements` 着手／承認 | `/moira-track requirements --feature <name>` |
| `/kiro-spec-design` 着手／承認 | `/moira-track design --feature <name>` |
| `/kiro-spec-tasks` 着手／承認（実装ノード誕生） | `/moira-track tasks --feature <name>` |
| 実装の見積合意 | `/moira-track estimate-impl --feature <name>` |
| `/kiro-impl` 実装→レビュー→承認 | `/moira-track impl --feature <name>` |
| 発火の取りこぼしが疑わしい／drift 警告を見た | `/moira-track sync` |

- **5 つの人間判断**（見積合意・割当・容量・スコープ・見積深さ）は、`moira-track` が**確認を取ってから** emit する。
  レビューで差し戻したら `/moira-track requirements` を再度呼べば達成率が後退し「差し戻しは無償でない」が数値で見える。
- いつでも `moira show`（ターミナル）／`moira ui`（ブラウザ）／`moira adapter drift`（.kiro との突き合わせ・read-only）で現状を確認できる。
