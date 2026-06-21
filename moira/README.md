# Moira

**Moira(モイラ)** — 仕様駆動 × チケット駆動 × EVM を統合する管理基盤の、アーキテクチャ以前の
「思想の確定」ワークスペース。

> 一文定義:**プロジェクトとは、見積を持つノードの木とポリシー付きの辺で結ばれた DAG の上を流れる
> 4種の追記専用イベント列であり、進捗・スケジュール・健全性はすべてその導出である。システムは
> 観測・導出・警告に徹し、コミットメントを伴う判断(見積の合意・割当・スコープ/期日・目標日の決定・
> 見積の深さ・容量 c の宣言——§2.1 の五判断)は人間に残す。**

名前の由来は μοῖρα「割り当てられた持ち分」= Earned Value/予算配賦、運命の三女神が三射影
(クロト=分解・計画／ラケシス=進捗測定・割当／アトロポス=完了・取消)に対応する。→ [`NAMING.md`](./NAMING.md)

## 現状

- 正典モデルは **v16**(独立敵対レビューのゲート=独立採点者の残存 Critical/Important = 0 を通って確定)。→ [`MODEL.md`](./MODEL.md)
  - v11–v16 で α_i/c(i,d) 容量・警告持続意味論・スケジュールバッファ(R-T6)・実行カバレッジ(R-S8)を追加。最新の編集的ハードニングは **v16 Phase 0**(正典分解の前提整備;§6 来歴参照)。
- 「完全に閉じた」とは宣言しない(モデル自身の P2「未発見は測れない」と一貫)。v16 時点で独立敵対
  レビューの Critical/Important はすべて決着。次段は本モデルの **CQRS 分解**(読 spec×10／書 skill×14;
  [`../.kiro/steering/roadmap.md`](../.kiro/steering/roadmap.md))。

## ファイル地図

| ファイル | 役割 |
|---|---|
| [`MODEL.md`](./MODEL.md) | **正典モデル**(単一の真実源)。公理・4イベント・不変条件・原理(P)・EARS 要件・§6 来歴・§7 確認事項。版は冒頭と §6 で追跡 |
| [`NAMING.md`](./NAMING.md) | 名称と由来(専門家レビュー済み) |
| [`validation-scenarios.md`](./validation-scenarios.md) | 検証シナリオ S1–S15(5群)。MODEL が「実際に使えるか」を機能面/判断面で検分。**次の一手=S4** |
| [`thought-experiments/`](./thought-experiments/) | 思想を鍛えた思考実験。01=フェーズ=ノードの発見、02=supersede の発見、…、11=進捗粒度と獲得ルール(実行カバレッジ R-S8 の起点) |
| [`DECISIONS.md`](./DECISIONS.md) | 意思決定ジャーナル。確定済み分岐・未解決論点・次の一手 |
| [`PROTOTYPE-EVALUATION.md`](./PROTOTYPE-EVALUATION.md) | 5プロトタイプを正典に照らした評価(背骨の有無・救出資産・毒) |
| [`UI-ARCHITECTURE.md`](./UI-ARCHITECTURE.md) | 画面アーキの橋渡し設計。被覆表(R-S2 導出×警告×区別表示→5サーフェス)とラフ画面構成。MODEL と `.kiro/` の中間成果物 |
| [`ui-mockups/`](./ui-mockups/) | UI-ARCHITECTURE の視覚化。自己完結 HTML モックアップ(ブラウザで開ける・要件ID注記) |

## このワークスペースの磨き方(方法論)

MODEL.md は「書いた本人が満足したらコミット」しない。**独立した敵対者による falsifiable ゲート**を
通してからのみ確定する:

1. **思考実験 / ユーザー判断 / 発見された欠陥** から変更を起こす
2. `moira-model-update` スキルを起動(Opus 4.8+ / effort max 推奨)
3. 独立敵対者(`moira-adversary`)が並列で穴を出す → genuine な分岐はユーザーに質問 →
   事実主張は `moira-fact-checker` で裏取り → 主コンテキストがパッチ → 独立採点者
   (`moira-gate-judge`)が「残存 Critical/Important = 0」を判定
4. 通過後、MODEL.md をその場で確定・版を上げ・§6 来歴を追記(評価語は「独立採点者の残存 = 0」)
5. 解消した分岐を `DECISIONS.md` に追記

> 自己採点(v1–v9 の「6次元満点」)は識別力を欠く儀式だった。v10 は独立採点に置き換えた——
> 独立敵対者が自己レビューの見落とした構造的綻びを多数検出したことが、その実例である。

## SDD 接続(進行中)

MODEL を本番アーキテクチャへ落とす **CQRS 分解**が `/kiro-discovery`(Path D)＋ doc-refine 敵対ゲートで確定し、
[`../.kiro/steering/roadmap.md`](../.kiro/steering/roadmap.md) に記録済み:読/導出=**読 spec×10**(`.kiro/specs/moira-*`)、
書/オペ=**書 skill×14**(`.claude/skills/moira-*`)。分解がモデルに触れる論点は `moira-model-update` の
**Phase 0**(0a–0e、commit 73bd69f で決着)で先に確定済み。次手は `/kiro-spec-batch`(Wave0 `moira-core` から依存順)。
既存 `evm-studio` / `sdd-dashboard` は使い捨てプロトタイプ実験であり、Moira はその失敗を踏まえた完全新規・別概念。
プロト(`moira/backend`・`moira/frontend`)は参照実装(フォワード本番)。
