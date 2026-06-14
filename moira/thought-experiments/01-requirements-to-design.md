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

- **requirements 承認** = `req-X` ノードの `implemented → accepted`(actor=human)。これが「開発者が承認した」の正体。仕様作業がそのまま出来高(EV_abs)に乗り、「仕様を書くのも進捗」が正確に実現する。
- **design 着手の解放**:`req-X` が `accepted` になったことで辺 `req→design`(既定 `accepted`;R-D2)が充足し、`design-X` が `ready` になる(R-D1)。**ready の契機は辺ポリシーの充足であって見積合意ではない**(見積合意は EV の basis 算入条件で、ready 判定とは直交)。続いて `design-X` の見積が合意され(EV の basis に入る)、エージェントが自己割当で `ready → implementing` へ進む。

各導出の動き:

| 導出 | 振る舞い |
|---|---|
| **EV / カバレッジ** | requirements 承認時点では実装タスクが未誕生(tasks 完了で未見積のまま生まれる;§2.3)。既知ツリーは est(req)・req・est(design)・design 等のフェーズ/見積ノードのみで実装側は未発見。完了した req-X の出来高(EV_abs)は計上されるが、合意済み見積が薄く**見積カバレッジは極めて低い**。**EV%(達成率)を「プロジェクト完了度」として見せてはならず**(R-S4)、低カバレッジを前面に出す。 |
| **レビューキュー** | design 進行中、人間キューは空。次の人間判断(design 承認)は design 完了後なので「エージェント作業中」ビュー。 |
| **スケジュール** | design-X の見積ぶんの作業スパンのみ。実装スパンは**未誕生＝未発見**で、未割当バックログ(存在するが未割当)ではなく**カバレッジの霧**(P2:未発見は測れない)として現れる。 |
| **AC / CPI** | req-X 分の cost は計上済み、design-X 分は進行中。この局面は**完了が少なく仕掛が多い**ため、CPI(=EV_abs/AC)は分子(完了のみ)と分母(仕掛 cost 含む)の領域非対称で悲観側に振れる(§3 導出指標。低カバレッジが原因ではない)。 |

## 辺ポリシーの帰結

フェーズ間の辺(req→design)は人間承認の `accepted` を要し、実装タスク間の辺は仕様FIXの `implemented` で足りる(R-D2)。この二種の自然な分離は「仕様の確定には人間承認が要るが、実装の連鎖は仕様FIXで足りる」という既確立の思想の帰結。なお `implemented` は判定であって保証ではなく、誤判定時は解放済み後続が P5 で at-risk 警告される(§2.5)。

## 確認できたこと

requirements 承認 → design 移行という最小の局面(req-X の accepted 遷移、design-X の ready/見積合意/implementing 等、複数イベント)を辿ると、Moira の全導出(EV_abs/EV%・カバレッジ・キュー・スケジュール・AC/CPI・木/DAG・権限)が一貫して動き、**破綻が見つからなかった**(網羅の証明ではない。MODEL §5・P2 と同じ留保)。これが **§2.6 フェーズ=ノード**の確定に至った。新公理・新イベント・新状態を要さない。
