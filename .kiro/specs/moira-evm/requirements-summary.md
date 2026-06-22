# moira-evm 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-evm` は、Moira 正典モデル `moira/MODEL.md`(SSOT) を本番アーキテクチャへ落とす **CQRS 分解の Wave1（読/導出側）**。基盤契約 `moira-core` が供給する effective-set・凍結属性・二層データを消費し、**EVM 会計（出来高・コスト・指数・カバレッジ）の導出を一箇所に集約して所有する**。指標の定義式そのものは MODEL §3／`moira-naming.md` を正典とし、本 spec はその導出契約・規律（de-rate・三者対読み・領域非対称・可視ギャップ）を確定する。

## 主要な要件の要点

- **（要件1）** EV の二形を導出する。絶対出来高 EV_abs（完了凍結予算の総和・合意済みのみ）と達成率 EV%（= EV_abs / 合意済み最新見積の総和、[0,1]）。分子に凍結予算、分母に最新見積を用い、両次元を混同しない。分母（合意済み見積総和）が 0 のとき EV% は honest empty として 0 とする。無印「EV」は EV% を指す。
- **（要件2）** 現行進捗（現行有効集合の EV%）と累積EV（supersede 済みを含む全葉の EV_abs・cancelled 除外）を区別して導出する。累積EV はサンク EV_abs（要件10）とは別量であり、cancelled ノードの出来高は累積EV には含まれない。supersede 済み旧ノードをカバレッジ分母に二重計上しない。
- **（要件3）** 見積カバレッジを、独立に合意済みの有効ノード数 / 既知有効ノード総数として導出し、未発見作業は測定不能として扱う。EV% の対データとして常に対で読ませ、未コミット領域（未合意・未見積）を可視ギャップとして公開する。
- **（要件4）** 低カバレッジ時の EV 解釈 de-rate のためのデータ供給。素の EV% と見積カバレッジを de-rate 適用可能な対データとして提供し、カバレッジ係数を EV_abs/EV% の式に織り込まない。de-rate の適用と提示制御は提示側（surface-*）に委ねる。
- **（要件5）** 実行カバレッジ executionCoverage を、合意済み有効葉のうち `implementing` にあるものの数比率として導出する。lifecycle 状態から決定的に導出し、スロットや平準化に依存しない。未合意の `implementing` 葉は分子・分母とも除外し、見積カバレッジのギャップとして現す。
- **（要件6）** 実行カバレッジの三者対読み。EV%・見積カバレッジ・実行カバレッジを同一導出から対データとして提供する。実行カバレッジを EV% と算術和して全体進捗として提示してはならない（次元が異なるため）。
- **（要件7）** PV（時間配分ベースライン予算）を、合意済み・スケジュール済み・非 cancelled の有効葉のうち凍結スロットが当該時点以前のものについて、凍結予算の総和として導出する。未合意・未スケジュールのサブ単位は PV から除外し、完了したが未スケジュールのサブ単位は EV_abs に含めつつ PV からは除外する（領域非対称）。
- **（要件8）** AC（実コスト）を木に沿って同型集約し、人間アテンション時間（MD）の単一通貨で記録する。仕掛中・cancelled のコストも含め、完了に依らない領域で導出する。滞留時間はコストではなくリードタイムとして扱う。
- **（要件9）** SPI（= EV_abs / PV）と CPI（= EV_abs / AC）を導出する。PV=0・AC=0 のとき null（指標未定義。honest empty の 0 とは区別する）を返す。CPI は現行有効 basis の単一 CPI に固定し、累積EV 基底の CPI 変種は持たない（surface-health の判断として `moira-health` が所有）。SPI de-rate は素の SPI とスケジュールカバレッジ（`moira-schedule` から消費）を対データとして提供し、式に織り込まない。CPI の分子（完了のみ）と分母（WIP 含む）の領域非対称は正規化せず開示する。
- **（要件10）** サンク EV_abs を、cancelled 状態ノードの出来高総和として別途保存せず導出する。累積EV とは別量。supersede 元（新ノード）が後に cancelled になったときはその出来高をサンクとし（終端 cancelled を優先）、現行有効集合へ復帰する旧ノードの EV_abs は累積EV basis に保持する。
- **（要件11）** thrashing 検出データを導出する。EV_abs が非増のまま AC が継続的に増え続けるノードについてシグナルを出す（期間は実装定義）。畳んだ見積活動の一度きりの cost は想定内として除外する。警告の確定・集約・解消は `moira-health` が所有し、本 spec は検出データの供給に徹する。
- **（要件12）** 全 EVM 導出を `moira-core` の projected 状態と effective-set に対する純関数として提供する。真実源も隠れキャッシュも持たず、`moira-core` が R-S2 として全 read 消費者へ単一導出を束ねられるようにする。再導出の契機・オーケストレーションは `moira-core` が所有する。

## スコープ

**やること（moira-evm が所有 -- 導出契約・規律）**
- **EV の二形と区別導出**: EV_abs / EV% の導出、現行進捗 vs 累積EV の区別導出。
- **カバレッジと対読み**: 見積カバレッジ・実行カバレッジの count-based 導出と、EV% との三者対読み規律。
- **EVM 指数**: PV / AC / SPI / CPI の導出と、領域非対称・de-rate データ供給規律。
- **サンクと検出データ**: サンク EV_abs の導出、thrashing 検出データの供給、可視ギャップ会計のデータ供給。
- **純関数ガードレール**: 全導出を core の projected 状態に対する純関数として提供（R-S2 への寄与）。

**やらないこと（上流/下流が所有）**
- effective-set 定義・basis 機構・latest-wins・凍結属性記録機構・状態機械・二層データ・I1 整合 enforce・R-S2 の単一導出束ね/再導出契機オーケストレーション = `moira-core`。
- 平準化・予測・slot 充填・スケジュールカバレッジ導出・schedule buffer = `moira-schedule`（本 spec は SPI de-rate のためスケジュールカバレッジを消費するのみ）。
- cancel 意味論・orphan・restoration = `moira-scope-deps` / `moira-cancel-scope`。
- 9 warning の確定・集約・行為列挙・clearance = `moira-health`（thrashing は本 spec が検出データを出し health が警告確定）。
- cost イベント発行（AC 入力 write）= `moira-cost-log` skill。
- 全 read サーフェスの提示 host・de-rate の提示制御・可視ギャップの提示 = `moira-surface-*`。
- 累積EV 基底の CPI 変種 = `moira-health`（surface-health の判断）。
