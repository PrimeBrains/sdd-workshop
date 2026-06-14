# 思考実験 01:requirements 承認 → design 移行

> 問い:開発者がある機能の requirements.md を承認し、AI が design フェーズに進む。このとき Moira はどう振る舞うか。
>
> この思考実験が **§2.6「フェーズもノードである」** を発見・確定させた。以下は MODEL v10 を前提とした到達点。

## 素朴な答えと、それが崩れた点

最初は「feature-X が `draft → requirements_approved → designing` と遷移する」と考えた。だが MODEL の状態語彙は task 層に寄っており、**feature 内部のフェーズ進行（requirements→design→tasks）をどう表すかが未定義**だった。これが思考実験の暴いた穴。

## 解決:フェーズもノード

「見積はノード」「作業はノード」と決めたなら、**フェーズもノード**である。feature-X の配下に `req-X / design-X / tasks-X` というフェーズ・ノードが生え、それぞれ既存の lifecycle 状態機械を再利用する（新状態は不要）。

- 木（所属):`feature ─┬ req ├ design ├ tasks └ 実装タスク群`。フェーズと実装タスクは feature の子として同列。
- DAG（論理依存):`req → design → tasks`、`design → 実装タスク`。木=所属、DAG=論理依存を混同しない。

## この局面での Moira の振る舞い

- **requirements 承認** = `req-X` ノードの `implemented → accepted`(actor=human)。これが「開発者が承認した」の正体。仕様作業がそのまま進捗(EV)に乗り、「仕様を書くのも進捗」が正確に実現する。
- **design 着手** は二段階:まず `design-X` の見積が人間に合意され（着手の認可)、次にエージェントが自己割当で `design-X` を `ready → implementing` へ。

各導出の動き:

| 導出 | 振る舞い |
|---|---|
| **EV / カバレッジ** | requirements 承認時点では実装タスクが未誕生(design 完了後に decompose で生える)。合意済み見積は req-X・design-X 程度で、**見積カバレッジは極めて低い**。EV%（達成率）を「プロジェクト完了度」として見せてはならず(R-S4)、低カバレッジを前面に出す。 |
| **レビューキュー** | design 進行中、人間キューは空。次の人間判断(design 承認)は design 完了後なので「エージェント作業中」ビュー。 |
| **スケジュール** | design-X の見積ぶんの作業スパンのみ。実装スパンは未誕生＝可視のギャップ(未割当バックログ)。 |
| **AC / CPI** | req-X 分は計上済み、design-X 分は進行中。低カバレッジ下では CPI も不安定。 |

## 辺ポリシーの帰結

フェーズ間の辺(req→design)は人間承認の `accepted` を要し、実装タスク間の辺は仕様FIXの `implemented` で足りる(R-D2)。この二種の自然な分離は「仕様の確定には人間承認が要るが、実装の連鎖は仕様FIXで足りる」という既確立の思想の素直な帰結。

## 確認できたこと

requirements 承認 → design 移行という最小のイベントが、Moira の全導出(EV%・カバレッジ・キュー・スケジュール・AC・木/DAG・権限)を破綻なく動かすことが確認でき、同時に **§2.6 フェーズ=ノード**の確定に至った。新公理・新イベント・新状態を要さない。
