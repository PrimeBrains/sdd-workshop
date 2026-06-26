---
created_at: 2026-06-26T16:40:00Z
title: requirements-spec-drafted の人間レビュー → P2 を葉基底へ正典化(v18・100%)＋担当列両面・玉のキュー移動・自分フィルタ・schedule詳細4日付を追加
bindings:
  - { kind: scenario, id: "units/requirements-spec-drafted" }
  - { kind: scenario, id: "units/estimate-spec-agreed" }
  - { kind: scenario, id: "units/estimate-spec-proposed" }
  - { kind: model, id: "MODEL v18 / P2" }
  - { kind: design-decision, id: "p2-leaf-basis" }
source: claude-code-session
---

## 要約

- **論点:** 開発者が確定済み(agreed)ユニット `requirements-spec-drafted` をレビューし、5点を指摘＋方針を提示。
  1. 見積カバレッジが **75%** で止まる。req/design/tasks を全葉見積したのに 100% では?
  2. 「玉＝人間」と書くが、**担当者列**を見れば玉持ちは明らか。担当列は無いのか?(両画面に欲しい)
  3. 「自分のレビュー待ちのみ」フィルタが **HTML で具体化されていない**。
  4. spec-value で**設計とタスクが1行**にまとまっている(おかしい)。
  5. 要件定義**単体の EV** は「出力まで進んだから 50%」では? それをどこで見る?
  - 方針: **参照実装は暫定スライス**。正として扱わず「要件としてあるべき姿」で書く。担当列は spec-value/schedule の**両面**に。太郎の「玉持ち」を**フィルタ/一覧**したい。schedule 詳細(クリック)に**予定開始/予定終了/実績開始/実績終了**を出す。

- **選択肢と決定:**
  - **見積カバレッジ 75% vs 100%:** ユーザーは「フィーチャー見積=子の合計で確定済み→100% が正しい」と判断。接地でも裏付け(ノード基底＋I1 ロールアップ親では分解木で 100% 構造的に不能・EV%/R-S6/R-S8 の葉基底と非対称)。→ **`moira-model-update` を起動し MODEL P2 をノード基底→葉基底へ是正(v17→v18)**。独立敵対ゲート(adversary×3→著者パッチ→同一ラウンド再反論→gate-judge)**PASS**。全葉合意=100% を実現。
  - **担当 vs 玉:** 接地の結果**担当≠玉**。担当(assignee)=作業者で、この打鍵では **Claude(agent)**(§5 actor=claude)。玉(手番)は lifecycle から導出(`implementing`→エージェント作業キュー、`implemented`→人間レビュー待ちキュー＝actor 非依存・`queues.ts`)。→ 玉の AI→人間は**2キュー間の移動**で描画。**担当列は両面**に出すが、玉とは別概念ゆえ担当列だけでは玉を表せないと明記。spec-value 担当列は現フロントエンド未実装ゆえ **⚠新規描画**、schedule 側は Inspector に担当表示が実在。
  - **自分フィルタ:** 「いま誰が見ているか(視点 actor)」を要する**新規要件**(参照実装は無効化)。§4 に HTML で明示し ⚠ 標識。
  - **要件定義単体の EV:** **二値**。implemented で凍結予算 3人日を満額計上(=自分の予算の100%)、**50% にはならない**(部分EVは MODEL v16 で却下)。フィーチャー全体の **EV%=30%**(3/10)。見る場所=spec-value ノード木/被覆表の「EV寄与 3」、schedule 詳細(Inspector)の「EV 出来高 3」(per-node の % 表示は実装に無い)。
  - **行分割:** 設計/タスクを別行に修正。
  - schedule 詳細の **4日付**: 予定終了=基準完了日(frozenSlot)はフィールド実在、予定開始・実績開始・実績終了は **⚠新規**(実績は transition の ts、予定開始は予定終了−所要から導出)。

- **理由:** I1 で原始的見積は葉のみ・親は Σ(合意済み子)のロールアップ＝§7#14(d) のとおり独立合意の対象でないため、葉基底は必要十分で情報を失わず全葉合意=100%、4つの被覆/EV 読みの基底が統一される。担当≠玉 は `queues.ts` の導出(humanReviewQueue=`implemented`・actor 非依存)に接地。新ふるまい(担当列両面・4日付・自分フィルタ)は人間発案ゆえ §4/§6/§7 に追加し **§3 は不変**に保った。

### 覆った判断

- **「P2 はノード基底＝75% が canon の設計」を撤回**(旧 `estimate-spec-agreed` §7・`requirements-spec-drafted`)。受け入れシナリオレビューで人間が「全葉合意なのに 75% は直感に反する」と指摘 → MODEL v18 で**葉基底＝100%** に是正。姉妹ユニット(estimate-proposed/agreed)も 100% へ同期。
- **moira-model-update 内の自己反証の過剰表現を訂正:** 「親値は I1 で(実装上も)完全決定ゆえ葉基底は情報を失わない」→ 再反論で「I1 は**規範**であり `fold.ts` は親見積を Σ 再計算しない。stale 親 estimateState/frozenBudget は node-state 読みに残る(P2 coverage や他の葉基底導出には非干渉)＝I1 実装 enforcement の既存事項・P2 スコープ外で deferred」へ正直化(MODEL §7#17)。
- **「§4 で F に `agreed` バッジ」を撤回:** 実 surface(`SpecValueSurface.tsx`)は葉のみ estimate pill 表示ゆえ、F(中間ノード)は estimate 無表示。§4 を「—(中間ノード＝独立見積なし)」に修正。

## 生ログ(該当範囲)

- **あなた**: (requirements-spec-drafted を見て) 見積カバレッジが 75% で止まる。全部見積もったのに 100% じゃないの? それと「玉＝人間」は担当者列を見れば分かるのでは(担当列は無い?)。自分のレビュー待ちフィルタが HTML で表現されてない。設計とタスクが1行になってるのはおかしい。要件定義単体の EV は出力まで進んで 50% では? どこで見ればいい?
- **Claude**: 参照実装(coverage.ts/ev.ts/queues.ts/各 surface)に当たって回答。① 75% は旧 P2(ノード基底・親 F を分母に含む)で正典どおり。② 担当≠玉(担当=作業者=Claude、玉=lifecycle 導出)で担当列では玉を表せない。③ 自分フィルタは視点 actor 不在で無効化(新規)。④ 設計/タスク1行はバグ。⑤ 要件定義単体は二値=3人日(50%でない)、全体 30%。— の2点(75%、担当列)は前提が正典/実装とズレている、と説明。方針(担当列両面・自分フィルタ・75%の扱い)を AskUserQuestion で確認。
- **あなた**: 担当者列は spec-value にも schedule にも両方必要。太郎の玉持ちを一覧/フィルタしたい。参照実装は仮なので正とせず、要件としてあるべき姿で。schedule には予定開始/予定終了/実績開始/実績終了を詳細クリックで見せる話もあった。/ 見積カバレッジは、フィーチャー見積=子の合計(10人日)で確定済みだから 100% が正しい。
- **Claude**: 75%→100% は MODEL 正典(P2)の変更ゆえ `moira-model-update` の敵対ゲートに回すか確認 → 「今すぐ回す」を選択。
- **Claude**: moira-model-update を実行。P2 をノード基底→葉基底へ是正する提案を adversary×3(V1–V6)で攻撃 → 同期スコープ過小・テスト破壊・「中間ノード合意は構造禁止でない→情報損失」Critical を検出 → 著者パッチ＋同一ラウンド再反論で「情報損失でなく §7#14(d) 整合回復」と決着(REBUTTAL SOUND) → gate-judge **PASS**。MODEL v18 確定(P2 葉基底)、coverage.ts/tests/NAMING/TE11/DECISIONS を同期、全46テスト緑。
- **Claude**: kiro-scenario に戻り requirements-spec-drafted を改修(カバレッジ100%・担当列両面〔spec-value は⚠新規描画〕・玉の2キュー移動・自分フィルタ⚠新規・schedule詳細4日付⚠一部新規・設計/タスク行分割・per-node EV寄与)。§3 は不変。姉妹ユニット(estimate-proposed/agreed)の 75%→100% を同期。
- **Claude**: doc-adversary×3(G1–G4＋SC1–SC7)で検証 → §4 の F に agreed バッジ・spec-value 担当列の⚠未標識・precondition の割当曖昧・詳細4日付の実在/例示混同・trace に moira-schedule 4.2 欠落・「5判断のうち4つ」の第5落とし・§7 の §3 誤引用 を検出 → 全てパッチで解消。
- **あなた**: (一次資料セットの確定を問われ)「このセットで確定」。
- **Claude**: SOURCE_SET_CONFIRMED=YES。gate-judge 再判定で確定。status を agreed に上げ、本会話ログを記録。
