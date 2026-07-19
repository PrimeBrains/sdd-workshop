# Moira — システム名称と由来
# Moira — Name and Etymology

> 本書は本システムの正式コードネーム **Moira(モイラ)** の由来を記す。
> ギリシア語・ギリシア神話の記述は一次資料および標準的な参照(Hesiod *Theogony*、Homer、Theoi/Mythopedia 等)に照らして検証済みであり、伝承の異同は誇張せず明記する。

---

## 1. 名称 / Name

**Moira(モイラ)** — 古代ギリシア語 **μοῖρα**。日本語表記「モイラ」は古典(エラスムス式)読みに従う慣用表記。

---

## 2. 語義 / Meaning

μοῖρα の原義は **「割り当てられたもの、分け前、持ち分」**、そこから転じて **「(各人に割り当てられた)運命・定め」**。具体的には部分・分割(軍の一部隊、地域の一区分など)も指す。語の中心にあるのは一貫して「**正当に分け与えられた分**」という観念である。

*μοῖρα means "that which is allotted — a part, share, or portion," and by extension "one's lot or destiny." The constant core sense is "one's rightful apportioned share."*

---

## 3. 語源 / Etymology

- 印欧祖語の根 **\*(s)mer-**「割り当てる、分け前を受ける」に遡るとされる。
- 関連語:動詞 **μείρομαι(meíromai)**「分け前を受け取る、分かち取る」、名詞 **μόρος(móros)**「定められた死・破滅」。
- 同根の観念が「分けること」と「定められた運命」を結ぶ。

*Likely from PIE \*(s)mer- "to allot." Cognates include the verb μείρομαι "to receive as one's share" and the noun μόρος "doom." The shared notion links "apportioning" with "allotted fate."*

> 注:語源は単一の整然とした派生として断定はできない。上記は標準的な見解の要約であり、細部には学説の幅がある。
> *Note: the derivation is not a single uncontested chain; the above summarizes the standard view.*

---

## 4. 神話における Moira / Moira in Myth

### 4.1 単数の Moira(ホメロス)
ホメロスの叙事詩では、**Moira(またはアイサ Aisa)はしばしば単数**で現れ、生の限界・終わりを定める、神々さえ完全には覆せない力として描かれる。「三女神」という観念は、ここではまだ固定されていない。

*In Homer, Moira (or Aisa) is often singular — the power that sets the limit and end of life.*

### 4.2 三女神 Μοῖραι(ヘシオドス以降)
**三柱の女神として名を与えたのは主にヘシオドス『神統記』**である。番号・名・系譜は作者により異なり、ヘシオドス自身、同じ『神統記』の中で彼女らを**夜の女神ニュクス(Nyx)の娘**とする箇所と、**ゼウスとテミス(Themis)の娘**とする箇所の双方を持つ(他の系譜も古来存在する)。

*The canonical three named goddesses come chiefly from Hesiod's Theogony. Their number, names, and parentage vary by author; Hesiod himself gives two different genealogies (daughters of Nyx; and of Zeus and Themis).*

### 4.3 三女神とその働き(慣用的対応)
ヘシオドス以降に標準化された、糸(生命)をめぐる役割分担:

| 女神 | ギリシア語 | 名の意味 | 糸への働き |
|---|---|---|---|
| クロト | Κλωθώ (Klothō) | 「紡ぐ女」(κλώθω 紡ぐ) | 生命の糸を**紡ぐ** |
| ラケシス | Λάχεσις (Lachesis) | 「籤を割り当てる女」(λαγχάνω 籤で得る) | 糸の長さを**測る/割り当てる** |
| アトロポス | Ἄτροπος (Atropos) | 「翻らぬ女・不可避」(ἀ- 否定 + τρέπω 転じる) | 糸を**断つ** |

> 注:この「紡ぐ・測る・断つ」の整然とした分業は、ヘシオドス的伝統で標準化されたものだが、伝承全体で一様に固定されていたわけではない(役割・名・数は作者により変動)。
> *The tidy "spin / measure / cut" division is the standard (Hesiodic-onward) scheme, but was not uniformly fixed across all sources.*

---

## 5. なぜ Moira か(本システムとの対応)/ Why Moira

以下は**本システムが神話に与える解釈的な対応づけ**であり、古代の教義そのものではない。
*The following is our interpretive mapping, not an ancient doctrine.*

第一に、**語義そのものが核心を突く。** μοῖρα「割り当てられた持ち分」は、本システムの中核である **Earned Value(獲得した価値の持ち分)** と **予算配賦(budget allotment)** を、ほぼ一語で言い表す。EVM とは文字どおり「持ち分の科学」である。

第二に、**三女神が三射影に対応する。** 一本の糸をめぐる紡ぐ・測る・断つは、本システムの三つの関心に重なる:
- **クロト(紡ぐ)= 分解・計画**(`decompose`:仕事の糸を生み出す)
- **ラケシス(測る/割り当てる)= 進捗測定・割当**(EV とスケジュール)
- **アトロポス(断つ)= 完了・取り消し**(`accepted` / `cancelled`:糸を断つ)

第三に、**一本の糸 = 単一の追記イベントストリーム。** 運命の糸が一本に紡がれて時間軸をなす像は、本システムの「唯一の追記専用ログ」と、その上を流れる出来事の不可逆な連なりに重なる。

> 将来、三つのダッシュボードに個別の通称が必要になれば、**Klotho(計画)/ Lachesis(進捗)/ Atropos(完了)** と呼び分けうる。ただしシステム本体の名は **Moira** である。

---

## 6. 表記の確定 / Canonical Forms

- 製品名(英字):**Moira**
- 日本語:**モイラ**
- ギリシア語原綴:**μοῖρα**(複数 Μοῖραι)
- 読み:MOY-rah(古典読み)

---

## 7. 正式用語 / Canonical Terminology

MODEL が定義する概念のうち、UI ラベル・議論・ドキュメントで揺れうるものの正式な日本語表記を確定する。

| 正式語 | 英字 / MODEL 記号 | 定義（MODEL 準拠） | 備考 |
|---|---|---|---|
| **コミット判断**（UI: コミット行為） | commitment decision / action | §2.1 の 5 つの人間判断（見積合意・割当・スコープ/期日/目標日・見積の深さ・c 宣言）の総称。システムは観測・導出・警告に徹し、これらの判断は人間に残る | 正典 MODEL の語は「コミット判断／コミットメントを伴う判断」（§0・§2.1）。UI 表示ではユーザー裁定により能動的な「コミット行為」を用いる（両者同義）。遷移(transition)・手戻り(backward transition)は**イベントの種類**であり、コミット判断はそれを発する人間の判断 |
| **実行カバレッジ** | executionCoverage (R-S8) | 現行有効・合意済み葉のうち `implementing` にあるもののノード数比率。「いま着手中の量」を集約レベルで可視化する count-based coverage（scheduleCoverage R-S6 と構造同型）。EV% と**算術和しない**（仕掛中の量≠出来高） | 完了主義の EV% が落とす「執行中」領域の補完読み。estimateCoverage(P2)・scheduleCoverage(R-S6) と並ぶ第三の coverage |
| **累積EV** | EV_abs (cumulative earned value) | **supersede 済みを含む**過去の総出来高（cancelled の sunk は**含まず別読み**＝R-C2 で active basis から除外）。R-S5 が「現行進捗 EV%」と区別して表示を要求する | 旧候補「累積稼得」は同義だがユーザー裁定で「累積EV」を採用。sunk(R-C2)は累積EV とは別量（MODEL §2.7） |
| **現行進捗** | EV% (current progress) | 現行有効集合（supersede されていない葉）のみで測る達成率。カバレッジ(P2)と対で読む | EV_abs と基底が異なるため独立に読む |
| **見積カバレッジ** | estimateCoverage (P2) | 合意済み有効葉 ÷ 既知の有効葉（葉基底・v18）。未発見は測れない(P2) | — |
| **スケジュール・カバレッジ** | scheduleCoverage (R-S6) | 合意済み作業のうちスケジュール済みの割合。低い間 SPI を de-rate | — |
| **担当（作業者）** | assignee (R-T5) | その作業を遂行する単一被割当者。c 平準化（P7）が消費する計画軸の主体。latest-wins・置換 | エージェントも可（A5/R-U11）。未割当は可視ギャップ |
| **レビュー担当** | reviewer (R-T5, v19) | `implemented→accepted` を行うべく指名された人間。assignee とは別の付帯属性・単一・**人間限定**・平準化/EV/PV/coverage を消費しない。指名(plan)で実承認者と異なってよい | 『特定のレビュー担当の分だけ』の絞り込みは per-node `reviewer`（Actor {kind,id}）を選んで突き合わせる提示層フィルタ（視点 actor/『自分』概念は要さない＝MODEL §7#18(f)）。未指名は可視ギャップ |

> **命名原則:** MODEL の英字識別子（camelCase）は MODEL・設計上の概念識別子、日本語は UI ラベル・文書での正式語。MODEL は「アーキテクチャ以前の思想の確定であり実装技術には立ち入らない」（MODEL §0）ため、**コード上の命名規約は各 spec/実装が定める**（本表はそれを強制しない）。非公式の別名・略語は都度コンテキストで補足してよいが、正式語を上書きしない。

> **MODEL 連動:** 本表は MODEL の用語に従属する派生記録である。MODEL が `moira-model-update` で改版され用語が追加/変更された場合、本表を再点検し同期する（`moira/UI-ARCHITECTURE.md` 確定来歴と同方針）。本セクションの**上表と本注記まで**は 2026-06-21 の Phase 0（MODEL v16 正典分解の前提整備）で moira-model-update 独立敵対ゲートを通過して確定（残存 Critical/Important = 0）——直後の 2026-07-05 追記はこの確定の射程外（別ゲート）。

> **追記（2026-07-05・doc-refine 独立敵対ゲート PASS・人間未批准・D-73/issue #23）:** 提示層の語「**ポートフォリオ / portfolio**」＝複数プロジェクト（home）の読み取り専用の**並置**（`moira ui --portfolio`）。**MODEL 外の概念**（本モデルの単一プロジェクト視点は不変 — D-50・MODEL §5）ゆえ上表の MODEL 従属語彙には含めない。「束ねる」は並置の意であり、会計の**合成**（横断 EV%/SPI/CPI のロールアップ）を意味しない（合成を出さないのは正典の禁止でなく D-73 の設計判断 — 詳細は ADR-0005）。

---

## 8. 出典についての注記 / Note on Sources

本書のギリシア語・神話に関する記述は、ヘシオドス『神統記』(三女神の命名と二重の系譜)、ホメロス(単数の Moira)、および標準的参照(Theoi Project、Mythopedia、Wikipedia の Moirai/Clotho/Lachesis/Atropos 項)に照らして確認した。伝承の異同(数・名・役割・系譜の変動)は事実として明記し、断定を避けた。
