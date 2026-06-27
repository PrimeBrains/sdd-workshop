---
created_at: 2026-06-27T00:00:00Z
title: スケジュール3部作（導出→組み替え→再ベースライン）を作成。frozenSlot凍結・R-S7陳腐化・理由付き再ベースラインをMODEL/参照実装へ接地し、3ラウンドの敵対ループでagreedへ
bindings:
  - { kind: scenario, id: "units/schedule-leveled" }
  - { kind: scenario, id: "units/schedule-reorder" }
  - { kind: scenario, id: "units/schedule-rebaseline" }
  - { kind: model, id: "moira/MODEL.md@v19" }
  - { kind: design-decision, id: "schedule-derived-c-leveled-reveals-same-person-capacity-conflict" }
  - { kind: design-decision, id: "frozenslot-frozen-at-first-scheduling-ready-not-at-assignment" }
  - { kind: design-decision, id: "reorder-via-dependency-edge-moira-has-no-manual-priority-field" }
  - { kind: design-decision, id: "rs7-is-cause-agnostic-so-relate-driven-divergence-is-detected" }
  - { kind: design-decision, id: "rebaseline-spec-permitted-by-core-7.3-carveout-not-mandated" }
  - { kind: design-decision, id: "rebaseline-agreed-as-goal-scenario-2layer-impl-task" }
  - { kind: impl-gap, id: "moira-rebaseline write skill（⚠未実装）＋ fold.ts frozenSlot ガード拡張（reason付き再ベースラインを未完了ノードに適用・完了はI4拒否）" }
  - { kind: spec-suggestion, id: "moira-schedule Req6.1: R-S7 原因例に『依存辺変更』を明示追加（cause-agnostic を文言でも明確化）" }
  - { kind: requirement, id: "moira-schedule: 1.1, 1.2, 1.3, 1.5, 5.1, 6.1, 6.2, 6.3, 9.1, 12.1, 12.2" }
  - { kind: requirement, id: "moira-core: 3.1, 3.3, 5.1, 6.1, 6.2, 6.3, 7.1, 7.3, 7.4, 9.1, 9.3" }
  - { kind: requirement, id: "moira-surface-schedule: 2.2, 3.1, 6.1, 6.4, 15.2" }
source: claude-code-session
---

## 要約

見積・割当の後、実際に着手するまでの間の「スケジューリング」を3つの受け入れシナリオ単位に起こし、検証ループで `draft → agreed` に確定した。3本はユーザーが順に発案した（§3 は人間意図）。

- **論点（ユーザー発案・§3 の種）**:
  1. **schedule-leveled**: 見積もった後にスケジューリングする段が抜けていた。本来は「太郎は今日 X の要件定義の予定が入っているから、今日は Y を始められない」と、割当→スケジュール導出の段で気づけるべき。同一担当者の複数作業が同日に重ならず逐次化されること＋初回スケジュール載り時に予定完了日が凍結されること。
  2. **schedule-reorder**:「凍結って後から動かせないって意味？ 後から『Y より Z を先に』と Y のスケジュールを変更することもあるが、できるという認識で合っている？」→ できる。これを独立シナリオ化。
  3. **schedule-rebaseline**:「この場合、実際はリベースラインまでやる。Y の基準が元々 7/3 で凍結されていたのを 7/5 で凍結し直して、実態としては遅延していません、にしたい」。

- **確認結果（接地）**: ユーザーの想定はいずれも MODEL v19＋参照実装と整合。正典・実装上の根拠：
  - **leveler**（P7/P8）＝人間の日次容量 c(i,d) を上限に充填し（[leveler.ts](../../moira/backend/src/leveler.ts)）、クリティカルパス優先・トポロジカル順で各葉の予測完了を導出。同一担当の2作業は同日に積まれず逐次化。
  - **frozenSlot（基準＝凍結PMB）と predictedCompletion（生きた予測＝EAC）は別物**（MODEL §3・[forecast.ts](../../moira/backend/src/derivations/forecast.ts)）。Gantt は破線PMB帯＋実線EACバーの2本を重ね描き、乖離を behind(橙)/ahead(緑)で示す（[ScheduleGantt.tsx](../../moira/frontend/src/surfaces/schedule/ScheduleGantt.tsx)）。
  - **R-S7 スロット陳腐化は cause-agnostic**（[DECISIONS.md:55](../../moira/DECISIONS.md)）。予測が凍結スロットと乖離すれば**原因不問で検出**——依存辺(relate)起因の乖離も当然に検出される。Inspector の遅延ピル `forecastBehind` は behind（予測>基準）側のみ（[Inspector.tsx:61-62,167](../../moira/frontend/src/surfaces/schedule/Inspector.tsx)）、ahead はガントの緑。
  - **再ベースラインは core 7.3 が「明示的な理由付き再ベースラインを除き不変」と permission（carve-out）で許可**（[moira-core requirements.md:140](../../.kiro/specs/moira-core/requirements.md)）。義務化（積極的 write SHALL）ではない。完了次元は 7.4 で I4 拒否。

- **決定（各 §7 へ記録・3本 agreed）**:
  - **leveled**:「スケジュールに載る（＝担当が付き leveler に入る・e060）」と「凍結（＝初回スケジュール載せ＝→ready・e061）」は別契機（leveler は assignee で判定し lifecycle 非依存）。asOf=7/1・frozenSlot=7/6 では **PV=0**（frozenSlot ≤ asOf 未到達ゆえ・[pv.ts:30](../../moira/backend/src/derivations/pv.ts)）。X→Y の順は容量＋クリティカルパス同点時 nodeId 昇順で、確かめるのは逐次化であって順序規則ではない。
  - **reorder**: Moira に手動の優先度フィールドは無く、「Z を先に」は依存辺 Z→Y（relate/dependency）で表現。R-S7 は cause-agnostic ゆえ relate 起因の遅れも検出・計上（当初の「R-S7 原因列挙に relate 欠落＝MODEL ギャップ／ESCALATE」評価は過大で撤回）。着手前（asOf=7/1）は SV=0、遅れは forecastBehind（前向き警告）で出る。Phenomenon B（基準自体の引き直し）は別ユニットへ。
  - **rebaseline**: 理由付き再ベースラインで基準を 7/3→7/5 に引き直し、予測と一致して遅れ標識が解除（moira-schedule 6.3）。Req12 AC2「予測導出中の不可侵」とは別経路（core 7.3 が明示的に carve-out）。履歴は消えない（初回 7/3 と再ベースライン 7/5 が両方ログに残る・理由必須＝監査/濫用抑止）。I4（完了ノード拒否）は本ユニットの場に完了ノードが無く実演しないため §3/§6 から外し §7 境界記録のみ。Z（先行）は据え置きで ahead 標識が残る。
  - **【最重要・実装ギャップ／rebaseline §7#1】** 本ユニットの核（frozenSlot 上書き）は **SPEC が許可するが現状どの実装でも満たされない**：write は `moira-rebaseline`（⚠未実装）skill 所有、加えて engine fold ガード（`n.frozenSlot===null`・[fold.ts:116](../../moira/backend/src/fold.ts)）の拡張が要る＝**2層の実装タスク**。他の ⚠未実装 write スキル前提の agreed シナリオ（estimate-propose 等）と同種で「シナリオが実装をリードする」標準運用。**ユーザー裁定（2026-06-27）で agreed（目標シナリオ）**。MODEL/spec 側に欠陥は無く moira-model-update は不要。

- **理由**: §3 の人間意図を不可侵に保ちつつ、「正典・実装に従うと §3 の素朴な像と細部が違う」点（PV の算入条件・載る≠凍結・R-S7 の cause-agnostic・再ベースラインが義務でなく許可で write 未実装）を §4–§6 で接地し §7 と注に開示。観測される結論は §3 のまま、内部表現は正典・実装のまま、を両立。

## 覆った判断（3ラウンドの敵対ループで是正）

検証ループ＝ `doc-adversary`×3（並列・独立、G1–G4＋SC1–SC7）→ `doc-fact-checker`（一次資料で裏取り）→ 著者パッチ → `doc-gate-judge`（現物照合 PASS）。一次資料9点はユーザーが AskUserQuestion で確定（SOURCE_SET_CONFIRMED、MODEL.md 最優先）。

**Round 1（初稿への攻撃）で是正:**
- **[Critical] PV=3 は誤り → PV=0**: leveled §4 で frozenSlot=7/6 > asOf=7/1 ゆえ PV 未算入（pv.ts:30／Inspector.tsx:52,54、fact-check C1）。
- **[Critical] §4 Gantt が実装と不一致 → 全面再描画**: 実装 ScheduleGantt.tsx は破線PMB帯＋実線EACバーの2本＋behind/ahead色分け＋基準日線。初稿の「▽マーカー＋単一バー＋バー内⚠遅延ラベル」を実装準拠へ（fact-check C2）。
- **[Critical→撤回] R-S7「原因列挙に relate 欠落＝MODELギャップ／ESCALATE」→ cause-agnostic ゆえ穴なし**: DECISIONS.md:55 で R-S7 は検出が原因不問と確定（fact-check C3）。ESCALATE 撤回、残るは requirements 文言整備の Suggestion のみ。
- **[Important 群]** トレース 4.3→3.3 誤引用訂正・核を支える core トレース追加・§6 EARS から MODEL 記号除去・§3 末尾の再ベースライン橋渡し行を When/Then ブロック外へ・「載る≠凍結」の契機分離・暦c=0簡略化注記・ノードID ローカル例示注記。

**Round 2（パッチ後の再攻撃。新規 Critical/Important を検出）で是正:**
- **[Critical] rebaseline の「SPEC 義務化済み」framing が不正確 → 「許可（carve-out）」へ訂正**: core 7.3 は "immutable **except by** an explicit reason-stamped re-baseline" ＝permission であって write 義務ではない。frozenSlot 上書きの write は `moira-rebaseline`（⚠未実装）skill 所有、engine ガード拡張も要る＝**2層未実装**。「engine が SPEC に未追従」は誤りで、engine ガードは 7.3 と両立（より immutable なだけ）。Round1 で「実装ギャップ・MODEL 欠陥なし」とした整理のうち**根拠の語（義務化）が事実と乖離**していた点を、agreed 裁定は維持しつつ正直化（§7#1/§5/§3 注、reorder §7#1 も整合）。
- **[Important] e061 のクロスユニット衝突 → 参照削除**: rebaseline §7#3 が「初回 e061（7/3）」と他ユニットの id を参照し、自身の「id ローカル」disclaimer と schedule-leveled の e061（frozenSlot=7/6）の双方に矛盾。id なしの「初回凍結 7/3」へ。
- **[Important] moira-surface-schedule トレース非対称 → 3本で統一**: 同じ Gantt/Inspector を描くのに leveled だけ surface を spec 欄に挙げ ID ゼロ、他2本は未掲載だった。3本に ID 列挙（2.2 両表示／3.1 バックログ／6.1 R-S7／6.4 標識解除／15.2 Inspector EVM）。
- **[FORK→standalone] 連番id＋「の直後」が flow 読みを誘発**: kiro-scenario は flow を v1 スコープ外とするため standalone に確定（rebaseline §2 を「終了状態を前提として引き継ぐ独立ユニット・id 非共有」へ、cross-unit id 参照撤去）。
- **[Suggestion] rebaseline After の Y 基準帯が緑（緑=ahead と衝突）→ 中立青へ**（収束=計画通りは青、緑は Z 先行専用）。

Round 1 gate＝PASS → Round 2 が新規 Critical/Important を摘出 → Round 3 パッチ → **Round 3 gate＝PASS（生存 Critical/Important = 0、SOURCE_SET_CONFIRMED、FORK 全ルーティング、MODEL エスカレーション不要）**。framing 訂正が agreed 裁定の実質を損なわない（他の ⚠未実装 agreed シナリオと同種）ことも採点者が確認。3本 status を draft → **agreed**。

## 生ログ（該当範囲）

- **あなた**: D-30（予定/実績は導出で出す）について、「完了予定」を記録するシナリオをまだ作っていない。完了予定は誰がいつ何の操作をした時に導出される？
- **Claude**: frozenSlot（記録・凍結＝初回スケジュール載せ）と predictedCompletion（毎イベント導出）の区別を説明。これが「見積→割当→スケジューリング→着手」の間のシナリオ未整備に繋がると指摘。
- **あなた**: 見積もった後にスケジューリングするシナリオを作っていない。太郎が今日 X の予定なのに Y を進めてしまう問題に、スケジューリングの段で気づくべき。見積決定〜着手の間にこのシナリオを入れたい。
- **Claude**: schedule-leveled をドラフト化（割当→c平準化→X の後に Y 配置→frozenSlot 凍結）。検証ループ前にレビュー依頼に応じドラフト提示。
- **あなた**: 凍結ってどういう意味？ 後から「Y より Z を先に」と Y のスケジュールを変更することもあると思うが、できる認識で合ってる？
- **Claude**: できる。凍結は「基準（物差し）」だけで作業の組み替えは禁じない。組み替えると生きた予測が動き、基準との差が遅延として見える。(1) 本シナリオに一文追加 (2) 別ユニット起票、を提案。
- **あなた**: 再ベースラインのシナリオも独立で作って。一旦ドラフトでレビューしたい。2本まとめて検証ループに。
- **Claude**: schedule-reorder をドラフト化（依存辺で組み替え→予測ずれ→R-S7 遅延）。grounding で2発見（R-S7 原因列挙に relate 欠落の疑い／Moira に優先度フィールド無し）を §7 に記録して提示。
- **あなた**: 今 Y が遅延の見え方になっているが、実際はリベースラインまでやる。Y の基準を 7/3 から 7/5 で凍結し直して、実態は遅延していません、にしたい。その部分のシナリオを作って。ドラフトでレビューする。
- **Claude**: schedule-rebaseline をドラフト化。grounding で「再ベースラインは MODEL 正典だが engine 未実装（fold.ts 初回ガード）」を最重要事項として記載し提示。3本揃ったと報告。
- **あなた**: 認識相違なかったので、検証ループを回してください。
- **Claude**: SOURCE_SET をユーザー確定（9点・MODEL 最優先）→ Round1 doc-adversary×3 → fact-check → 主要発見が判明：PV=3 は誤り、Gantt が実装と不一致、R-S7 は cause-agnostic（原因列挙ギャップは MODEL 欠陥でない）、再ベースラインは core 7.3/7.4 が規定（当初は「義務化」と表現）。MODEL エスカレーション不要と判定。rebaseline の agreed/draft を FORK でユーザーへ。
- **あなた**:（AskUserQuestion）rebaseline は **agreed（目標シナリオ）** で確定。
- **Claude**: Round1 パッチ（PV=0・Gantt 再描画・トレース訂正・EARS 記号除去・§7 再枠）→ gate PASS。ただし新 Gantt は未攻撃・反証は再反論要として Round2 を実施 → **新規 Critical（「義務化」は不正確＝core 7.3 は permission・write は未実装 skill＋engine 拡張の2層）・Important（e061 衝突・surface トレース非対称）・FORK（standalone/flow）を摘出** → Round3 パッチ → gate **PASS**。3本 agreed、本会話ログを保存。
