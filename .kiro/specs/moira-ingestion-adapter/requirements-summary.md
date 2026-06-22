# moira-ingestion-adapter 要件 早わかり

> requirements.md(EARS 形式の要件本文)を読む前に全体像を掴むための要約。詳細は [requirements.md](./requirements.md) へ。

## 目的

`moira-ingestion-adapter` は、Moira 正典モデル `moira/MODEL.md`(SSOT) を本番アーキテクチャへ落とす **CQRS 分解の Wave1**（依存 = `moira-core`）。外部の仕様方法論が産む段階的成果物（抽象 spec-unit）を入力に、**ノード候補と見積提案**へ正規化する **read-only producer** である。MODEL の文言は変えず・新概念は足さず、その実装落とし込み（spec-unit 正規化）に徹する。`moira-core` が所有する契約概念（emit/derive・二層データ・状態機械等）は消費し、再定義しない。

なお roadmap 注（roadmap.md line 106）は「0c が単一ソース確定なら spec-ingest skill へ吸収（条件付き存続）」と記すが、requirements.md は 0c の方法論非依存化が多ソースを許す設計であるため吸収条件は不成立と判断し、独立 read spec として凍結している。

## 主要な要件の要点

- **方法論非依存の spec-unit 入力境界（要件1）**：特定方法論に縛られない抽象 spec-unit を入力境界に取る。cc-sdd 固有語彙は内部マッピングに閉じ込め、出力へ漏らさない。他方法論（Scrum・ウォーターフォール等）への一般化は意図するが網羅的には主張しない（MODEL の hedge を継承）。
- **フェーズ成果物からノード候補への正規化（要件2）**：各フェーズ成果物を feature 配下の候補子ノード（req / design / tasks 等）へ正規化する。木の所属と論理依存 DAG は区別して提案する。二段 decompose では第二 decompose の主語を feature とし、実装タスクを tasks ノードの子ではなく兄弟に置く。初期 lifecycle 状態は `moira-core` の状態機械に従って提案し、再定義しない。
- **一様な見積連鎖に沿った見積提案（要件3）**：前段成果物を入力に見積を候補ノードとして表現し、est がフェーズに先行する DAG 辺を提案する。最初の見積 est(req) の入力は roadmap/brief 等の外部所与で後退を接地する。見積結果は出所を問わず `proposed` として産出し、`agreed` へは遷移させない。見積提案は候補 `decompose` 入力の値（R-E2 の記録形）として表現し、実際の emit は下流に委ねる。
- **実装見積は tasks と別個ノード（要件4）**：実装見積を tasks ノードや decompose 候補とは別個の、tasks.md を入力とする候補ノードとして扱い、decompose に内包させない（R-E1b）。tasks 完了時に実装タスク群は未見積で誕生し、別個の est(impl) がカバレッジを回復する提案とする。
- **非 spec 作業単位の候補化（要件5）**：運用タスク・バグ修正・ad-hoc 作業を `moira-core` が定義する A1 射程に従って候補 feature ノードとして提案する（分類の定義は core が所有、本 spec は消費）。フェーズ周期の省略は分解の深さ（人間のコミット判断 P0）であり lifecycle 状態の省略ではない。バッファ等の導出会計量はノード候補としない（isBuffer 却下を消費）。
- **read-only producer（要件6）**：正規化出力は呼出可能な write シームを一切持たず、4 イベントの emit・ログ/ノード状態/第二データ層への書き込みは構造的に不能とする。出力は候補・提案であって正本ではなく、下流 write skill が emit し人間が合意して初めて正本化される。read-only 性の定義自体は `moira-core` R2 が所有し、本 spec はそれを消費する。
- **正規化の決定性と core 契約の消費（要件7）**：同一 spec-unit 入力から同一のノード候補・見積提案を産出する（producer 設計保証としての決定的読み出し）。ノード候補・見積提案は `moira-core` が定義する語彙（イベント型・状態機械・木/DAG・`proposed`/`agreed` 状態）で表現し、概念を再定義しない。候補に event id や `(ts,id)` 順序は付与せず、決定的マージ（I3）は発行時の core に委ねる。

## スコープ

**やること（ingestion-adapter が所有）**
- 抽象 spec-unit を入力境界とする方法論非依存の正規化（cc-sdd は参照例として内部マッピングに閉じ込め）。
- フェーズ成果物からノード候補（木所属・DAG 論理依存・lifecycle 初期状態の提案）への正規化。
- 一様見積連鎖に沿った `proposed` 見積提案の産出（R-E1/E1b/E2 の入力として）。
- est(impl) を tasks と別個のノード候補として扱う提案。
- A1 射程に従う非 spec 作業単位（運用/バグ/ad-hoc）の候補化。
- 正規化の決定性（同一入力から同一出力）と read-only 性（emit せず・ログ/状態/第二層を mutate しない）。

**やらないこと（上流/下流が所有）**
- イベント型・lifecycle/見積合意 状態機械・effective-set・latest-wins・二層データ・凍結記録の**定義** = `moira-core`（消費のみ）。
- 4 イベントの **emit** と取り込みの正本化 = `moira-spec-ingest` skill。
- 見積の**合意確定**（`proposed` から `agreed` への遷移・人間承認）= `moira-estimate-agree` skill。
- 分解の深さ・ノード化/畳むの**確定**（人間のコミット判断 P0）= 人間 + write skill。
- EV/被覆/PV 等の**導出** = `moira-evm` / `moira-schedule` / `moira-health`。
- ノード状態の正本（現行 lifecycle 状態）= core の fold。
- 永続化・UI。
