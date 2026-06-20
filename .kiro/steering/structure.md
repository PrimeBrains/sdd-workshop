# 構成: Moira

## 正典ナレッジの所在

Moira の確定ナレッジは `moira/` にある。**唯一の真実源は `moira/MODEL.md`**（公理・4イベント・不変条件・原理 P・EARS 要件・来歴 §6・確認事項 §7）。steering はこれを複製せず、制約チェックリストと章ポインタに徹する（[moira-model.md](moira-model.md) / [moira-naming.md](moira-naming.md)）。

| 場所 | 役割 |
|---|---|
| `moira/MODEL.md` | 正典モデル（単一の真実源）。変更は `moira-model-update` ゲート経由 |
| `moira/NAMING.md` | 名称・由来。語彙の steering 窓口は [moira-naming.md](moira-naming.md) |
| `moira/validation-scenarios.md` | 検証シナリオ S1–S13（spec の seed 源） |
| `moira/UI-ARCHITECTURE.md` ・ `moira/ui-mockups/` | 画面アーキ（被覆表・ラフ構成）とモックアップ |
| `moira/DECISIONS.md` ・ `moira/thought-experiments/` | 意思決定ジャーナル / 思考実験 |
| `moira/PROTOTYPE-EVALUATION.md` | 旧プロトタイプ 5 本の Moira 有用性評価 |
| `moira/backend/` | S4 最小バックエンド（参照実装の縦スライス） |

## spec の命名と seeding

- Moira の spec は `.kiro/specs/moira-*` に置き、kebab-case で命名する。各能力は検証シナリオ S1–S13 が seed する（`moira/README.md`「将来の SDD 接続」）。
- `spec.json` の `language` は **ja**、`app` は **moira**（単一プロダクトのため分類は moira に一本化）。
- 旧アプリ（evm-studio / sdd-dashboard）の spec・steering は除去済み・再作成しない（経緯は [product.md](product.md)）。

## Single Source of Truth 規律

- **`moira/MODEL.md` が唯一の真実源**であり、矛盾時は MODEL が勝つ。steering 各ファイルは事実を 1 箇所でのみ restate し、他はポインタする（重複を作らない）。
- **語彙の所有者は [moira-naming.md](moira-naming.md) 一つ**。他の steering は用語を再定義せず使う。
- 引用は**章 ID（A2, P7, §2.1, R-S6 等）**で行い、バージョン番号は書かない（陳腐化回避）。

## コード組織（`moira/backend` の実体）

参照実装は MODEL の data → derivation → warn を層として写している。新コードもこの境界を保つ（具体ファイル名は列挙せず、層の責務だけを規約とする）:

- **追記専用ログ層** — 4イベントのログ + c(i,d) の第二層。真実源（A2 / R-U14）。
- **畳み込み層** — `(ts,id)` 決定的 fold（循環 relate 拒否・エージェント合意拒否）→ Projected 状態（I2 / I3 / R-U4）。
- **導出層** — 純関数群（ノード状態／EV／カバレッジ／PV／AC／SPI・CPI／キュー／予測／有効集合）を 1 つのオーケストレータが R-S2 の導出群として組み立てる。
- **read 層** — snapshot CLI・read-only HTTP。導出を出すだけで真実源・可変状態を持たない（層間に隠れたキャッシュを置かない）。

永続化・UI など全体構成は未確定（[tech.md](tech.md)）。
