# 変更管理フロー 作業台帳（moira/changes/）

> **非正典宣言（最重要）**: このディレクトリ配下のファイルはすべて**使い捨ての作業台帳**であり、
> **正典性を持たない**。ここに書かれた内容は**根拠として引用しない**——grep でヒットしても
> **現況を主張しない**。`.kiro/specs/moira-*` の R/D/T アーカイブが「生成時点のアーカイブ」であり
> 参照時は「当時の射影」として扱われる規律（[`.kiro/steering/moira-verification.md`](../../.kiro/steering/moira-verification.md)
> 「R/D/T は使い捨ての再生成物」節）と**同型**である。正典と食い違えば、常に正典
> （MODEL・agreed シナリオ・agreed Decisions・PROPERTIES・steering）が勝つ。
>
> クローズ後もファイルは**削除しない・同期もしない**——issue が閉じた時点の記録としてそのまま残す。

## これは何か

Moira の変更管理フロー（規範: [`.kiro/steering/moira-change-management.md`](../../.kiro/steering/moira-change-management.md)。
設計来歴は [`moira/plans/2026-07-19-change-management-dfd.md`](../plans/2026-07-19-change-management-dfd.md)）の
各工程（P1〜P6）が読み書きする、issue ごとの作業台帳の置き場（steering §7）。

## 構造

issue ごとに `moira/changes/issue-N/` 配下へ以下を置く（N は GitHub issue 番号）:

| ファイル | 内容 | 出力工程 |
|---|---|---|
| `request.md` | 変更要求票 | P1 受付・正規化 |
| `impact-map.md` | 影響マップ＋人間断面ビュー（append-only） | P2 影響調査 |
| `intent-ratification.md` | 意図批准記録（HA 前半集約セッション） | P3 ルーティング裁定 |
| `fork-batch.md` | fork バッチ（HB）——**発生時のみ** | P4 ゲート実行中 |
| `closure-report.md` | 閉包レポート | P5 同期閉包確認 |

上記に加えて、必要に応じて受け入れテストレポート等の補助 md をこのディレクトリに追加してよい
（上表は最小構成であり、これで全ファイル種別を限定するものではない）。

各ファイルの様式（見出し構造・記入欄）は [`.claude/skills/moira-change/templates/`](../../.claude/skills/moira-change/templates/)
のテンプレートに従う。

## frontmatter 規約

各ファイルは以下を frontmatter に持つ:

```yaml
---
status: working-ledger
issue: N
---
```

## P5 未マップ差分検査からの自己除外

steering §5 のとおり、P5 は `diff(base..HEAD)` の未マップ差分（changed − mapped）が空であることを
閉包の必要条件とする。**`moira/changes/**` はこの検査対象から除外される**——除外しないと、
台帳自身の更新（影響マップへの追記・閉包レポートの追加など）が「未マップの変更」として検出され、
台帳を書く行為そのものが閉包を壊す自己言及に陥るため。

## 分担: 人間向け要約は issue コメント、詳細台帳はここ

- **人間向け要約** → GitHub issue コメントに残す。前半集約セッション（HA）の結果と、クローズ時の
  閉包サマリ（「できないことになったこと」の差分を含む）だけを短く書く。モバイルで読むのは issue 側。
- **機械と AI が読む詳細台帳** → このディレクトリ。issue API 往復の遅さを避け、台帳が変更本体と
  同じ git 履歴に乗る（steering §7）。

## 正典はどこか

本ディレクトリの運用規範そのもの（フローの定義・工程の in/out・人間タッチポイント等）の**唯一の正典**は
[`.kiro/steering/moira-change-management.md`](../../.kiro/steering/moira-change-management.md)
（ratified DFD の確定版）である。skill `.claude/skills/moira-change/` はその**非規範の振り付け実装**
（食い違えば steering が勝つ）であり、このディレクトリと個々の working-ledger ファイルは規範に従って
**生成される作業成果物**であって、いずれも規範そのものではない。
