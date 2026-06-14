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

## 7. 出典についての注記 / Note on Sources

本書のギリシア語・神話に関する記述は、ヘシオドス『神統記』(三女神の命名と二重の系譜)、ホメロス(単数の Moira)、および標準的参照(Theoi Project、Mythopedia、Wikipedia の Moirai/Clotho/Lachesis/Atropos 項)に照らして確認した。伝承の異同(数・名・役割・系譜の変動)は事実として明記し、断定を避けた。
