# 思考実験 04:キャンセルの依存先への伝播と DAG の永久ブロック

> 問い:ある feature/ノードが `cancelled`(R-C1)へ取り下げられたとき、それを **DAG で先行とする依存先**はどうなるか。先行が二度と `accepted`/`implemented` に到達しないなら、後続は `ready`(R-D1)になれるのか。キャンセルは伝播するのか、孤児化して永久にブロックされるのか。
>
> この思考実験は MODEL §4.4(スコープ変更)と §4.5(依存・整合)の接合部に**穴を露呈させた**(MODEL 自体の修正は後の moira-model-update に委ねる。本書は露呈に徹する)。以下は MODEL v10 を前提とする。

## 素朴な期待と、それが破れた点

最初は「`cancelled` は終端状態(§2.5)なのだから、依存先はシステムが面倒を見る——伝播して連鎖キャンセルするか、少なくとも『先行が消えた』と警告する」と期待した。だが MODEL を読むと、その規則がどこにも無い。

- R-C1(L274)は「feature 取り下げ時、終端 `cancelled` への `transition` を発行」とだけ定める。R-C2(L277)は「取り消しノードを稼働 basis から除外し、サンク EV_abs を…導出」とだけ定める。**いずれも当該ノードの会計処理(basis 除外・サンク計上)を述べるのみで、そのノードを先行とする辺の運命には一切触れない。**
- R-D1(L282)は「先行群が辺の閾値ポリシーを満たしたとき `ready` とマーク」とだけ定める。R-D2(L285)の既定閾値は仕様フェーズ辺=`accepted`、実装タスク辺=`implemented`。**「先行が `cancelled` になった場合」という条件分岐は R-D1/R-D2 に存在しない。**
- §2.5(L90)の状態機械は `pending → ready → implementing → implemented → accepted`(+ **終端** `cancelled`)。`cancelled` は終端ゆえ、そこから `accepted`/`implemented` へは二度と進めない。

つまり**先行が `cancelled` になると、その依存辺の閾値は永久に充足不能**になる。これが素朴な期待の破れた点であり、本実験の暴いた穴。

## 分析本体:三つの局面で導出が未定義になる

### 局面A:cross-feature 依存の永久ブロック

feature-B の先行に feature-A(の終端ノード)を置く cross-feature 依存辺(§5 L310「feature 横断の先行関係」)を張った後、feature-A を `cancelled` にする。

| 導出 | この局面での振る舞い | 根拠/沈黙 |
|---|---|---|
| **DAG / ready** | feature-B の依存辺は閾値(`accepted` か `implemented`)を要するが、feature-A は `cancelled`(終端)で二度と到達しない。**B は永久に `pending` のまま。** | R-D1/R-D2 は「充足したら ready」しか定義せず、**充足不能になった辺の扱いが無い** |
| **スケジュール** | B は `ready` にならず、割当もスケジュールにも載らない(§2.4 L87:割当のないタスクは載らない)。だが「未割当バックログ(P0/R-U9)」とも違う——**割当できないのではなく、解放されないために割当対象にすらならない** | P0/R-U9 の可視のギャップは「未コミット」を映すが、**「永久ブロック」を映す導出は無い** |
| **at-risk 警告** | P5(L151-154)が警告する at-risk は「`implemented` 到達**後**の後退遷移=仕様FIX判定の誤り」であって、**先行のキャンセルに起因する後続のブロックは P5 の対象外**。R-T3(過負荷)・R-T4(期日超過)・R-S3(thrashing)のいずれも該当しない | 永久ブロックを検知する導出シグナルが**どの原理にも無い** |

結果:**B は永久に動けず、しかもその事実を告げる導出シグナルが一つも出ない。** 「観測・導出・警告に徹する」(§0)はずのシステムが、この異常を観測も警告もしない。

### 局面B:フェーズノードの途中キャンセルと feature の運命

§2.6 でフェーズ(req/design/tasks)は feature の子ノードであり、DAG は `req → design → tasks`。ここで design-X だけを `cancelled` にする(req-X は `accepted`、tasks-X は `pending`)。

- DAG `design → tasks` の閾値が永久充足不能になり、tasks-X は局面A と同じく永久ブロック。
- さらに前提として、**R-C1 は取り消しを「feature 取り下げ」と表現**する(L274「feature 取り下げ時」)。一方 §2.5(L90)の終端 `cancelled` は task 層の状態機械にもあり、§2.6 はフェーズ・実装ノードが「同じ lifecycle 状態機械を再利用する」とする。**では単一フェーズ・ノード(feature 全体ではなく design-X だけ)を `cancelled` にすることは許されるのか、許されるなら親 feature と下流フェーズはどう扱うのか**——R-C1/R-C2/§2.6 のいずれも明示しない。「feature 取り下げ」と「ノード単位のキャンセル」の関係が未確定。

### 局面C:supersede 旧ノードのキャンセルと EV_abs の二重定義

§2.7(L102-108)で、エンハンスは旧ノードを後退遷移せず `新ノード →(supersede)→ 旧ノード` を張り、**旧ノードは `accepted` のまま不変**(L105)、**旧ノードの EV_abs は累積稼得 basis に残る**(L107)。ここで旧ノードを `cancelled` にしようとする。

- まず **`accepted` から `cancelled` へ遷移できるのか**が未定義。§2.5(L90)で**終端と明記されるのは `cancelled` のみ**で、`accepted` の終端性は明示されない。`accepted → cancelled` が許されるか否かが状態機械として確定していない。
- 仮に許されるとして、**会計が矛盾する**:§2.7 L107 は「supersede された旧ノードは累積出来高 EV_abs の basis に残る」と言い(同 L108 はこれを「累積稼得」とも呼ぶ)、R-C2 L277 は「cancelled ノードを稼働 basis から除外しサンク EV_abs として導出」と言う。**supersede されかつ cancelled でもあるノードの EV_abs は、累積稼得(§2.7)なのかサンク(R-C2)なのか。** 二つの規則が同一ノードに相反する帰属を与え、優先順位の規定が無い。

## 見つかった穴

- **[Critical] §4.5(R-D1 L282/R-D2 L285)× §4.4(R-C1 L274/R-C2 L277)** — 先行ノードが `cancelled`(終端;§2.5 L90)になったときの依存先の解放規則が**存在しない**。閾値(`accepted`/`implemented`)は永久充足不能になるが、キャンセルの伝播も、孤児化した後続の検知・警告も未規定。結果として後続は永久ブロックされ、かつ P5/R-T3/R-T4/R-S3 のいずれにも該当しないため**導出シグナルがゼロ**。「警告に徹する」(§0)システムがこの異常を観測も警告もしない。/ モデルは R-D1 を「充足→ready」としか書かず「充足不能」状態を語彙に持たない。/ V6(未処理ケース)・V2(R-D1 と R-C1 の沈黙の境界)。
- **[Important] §2.6 × §4.4(R-C1 L274)** — キャンセルが「feature 取り下げ」(L274)として書かれる一方、§2.6 はフェーズ・実装ノードが同じ lifecycle を再利用するとする。**単一ノード(フェーズ/実装)単位のキャンセルが定義されているか、定義されるなら親 feature・下流フェーズをどう扱うかが silent**。feature 取り下げとノード単位キャンセルの関係が未確定。/ V6。
- **[Important] §2.7(L107)× R-C2(L277)** — supersede 旧ノードを `cancelled` にした場合、その EV_abs が**累積稼得 basis に残る(§2.7)のかサンクとして計上される(R-C2)のか矛盾**し、優先規定が無い。加えて `accepted → cancelled` 遷移の可否そのものが状態機械(§2.5 L90、終端は `cancelled` のみ明示)で未確定。/ V2(相反する basis 帰属)。

これら三点を辿ると、キャンセルという最も基本的なスコープ操作が、DAG の依存・supersede の会計と整合する形では閉じておらず、**穴が見つかった**(網羅の証明ではない;MODEL §5・P2 と同じ留保)。

*Cancellation defines only the cancelled node's own accounting (R-C1/R-C2); it is silent on the fate of edges that depend on it. A cancelled predecessor's threshold becomes permanently unsatisfiable with no propagation, no orphan detection, and no derived warning — and node-level cancel vs feature-withdrawal, plus the cumulative-vs-sunk EV_abs of a superseded-then-cancelled node, are undefined.*

## レビュー来歴

独立敵対レビュー(自己検証ループ:fact-checker + 反転 adversary×3 + gate-judge)でゲート通過(誤引用0・論理破綻0・全 finding が論破を生存)。3 体の反転 adversary が V1(必要性)/V2(矛盾狩り)/V3(過剰主張)の各角度から計9回、3 findings を論破試行したが、cancelled 先行の依存解放・ノード単位キャンセルの親子波及・supersede×cancel の EV_abs 優先/accepted→cancelled 可否を処理する MODEL 本文は皆無で、全て refuted=false(穴は実在)。主な是正:L43 の逐語引用「累積稼得」を §2.7 L107 の実語「累積出来高」に訂正(L108 が同義語と明記)。

