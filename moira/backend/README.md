# Moira S4 最小バックエンド

検証シナリオ **S4「健全性のリアルタイム把握」**（`../validation-scenarios.md:29-34`）を縦に貫く、動く最小実装。Moira の背骨——**追記専用4イベントログを唯一の真実源とし、fold（畳み込み）で全導出する**——を最小コストで実証する純TS縦スライス。

仕様は `../MODEL.md`（v14）と S4 シナリオ。本パッケージは SDD ドキュメント・DB を持たず、純関数の導出エンジン + 追記専用ログ（メモリ/JSON）+ 薄い read 口だけで構成する。

## 背骨

```
イベントログ(4種, 追記専用)  ──fold──▶  ProjectedState  ──derive──▶  DerivedState(11導出)  ──read──▶  JSON/CLI
        + c(i,d) 第二層 ────────────────────────────────────┘
```

- `src/types.ts` — 4イベント（`transition`/`decompose`/`relate`/`cost`）, ノード, c(i,d), `DerivedState`
- `src/event-store.ts` / `src/capacity-store.ts` — 追記専用ログ / c(i,d) 第二層（既定 1.0）
- `src/fold.ts` — `(ts,id)` 決定的畳み込み（循環 relate 拒否, agent 合意拒否）
- `src/derivations/*` — 各導出（純関数）
- `src/leveler.ts` — P7 貪欲 c平準化（生きた予測）
- `src/derive.ts` — 11導出を組み立てるオーケストレータ（R-S2）
- `src/read/` — `snapshot-cli.ts`（主）, `http.ts`（任意・read-only）

## 実行

```bash
cd moira/backend
npm install
npm test            # Vitest 全テスト（golden が手計算値に一致）
npm run snapshot    # 同梱 golden fixture の導出スナップショットを出力
npm run snapshot -- --asOf 2026-01-15
npm run serve       # 任意: GET http://localhost:3002/derived?asOf=2026-01-28
```

## S4 が導出する 11 種（R-S2 `MODEL:283`）

1. 各ノード状態 / 2. EV% / 3. EV_abs / 4. 見積カバレッジ / 5. スケジュールカバレッジ / 6. PV(t) / 7. AC / 8. SPI / 9. CPI / 10. 各キュー(P4) / 11. 生きた予測スケジュール + 未割当バックログ

判断面の核心は2つのペア読み（`validation-scenarios.md:31`）。エンジンは生の SPI と各カバレッジを返し、デレートは提示側に委ねる:

- `EV% ↔ 見積カバレッジ`（R-S4）
- `SPI ↔ スケジュールカバレッジ`（R-S6）

## 強制 vs 延期（最小段階の線引き）

数字を変えるルールは全て**強制**、警告の相方データは全て**提供**。延期したのは「警告述語」と S4 に入力の無い機能のみ。

| MODEL 項目 | 警告 | 下位ルール | 本実装 |
|---|---|---|---|
| R-U8 合意完了のみ算入 | (規則) | EV_abs | 強制 |
| R-U13 未合意完了 | 延期 | EV_abs から除外 | 強制 |
| R-U12 矛盾合意 | 延期 | latest-wins(I3) | 強制（agreedActorValues 記録） |
| PV 3除外 (`MODEL:197`) | (規則) | PV | 強制 |
| R-S5 supersede/有効集合 | (規則) | 有効集合 | 強制 |
| R-C2 cancelled 除外 | (規則) | basis | 強制 |
| R-S6 / R-S4 デレート | 延期(提示) | カバレッジ | データで返す |
| R-S7 stale-slot | 延期 | forecast に frozenSlot+predicted | データで返す |
| R-T3 過負荷 | 延期 | leveler が c 消費 | 予測遅延で現れる |
| R-S3 / R-T4 / R-C3 / P5 | 延期 | — | 延期（要追加入力/窓） |
| 警告の acknowledge/dismiss | — | 可変状態を持たない | 持たない（§2.1） |

## golden fixture（`src/fixtures/tiny-project.ts`）

feature `F` + 葉 req4/design6/tasks2/impl-1 8/impl-2 6（全合意）。完了: req/design/tasks→accepted, impl-1→implemented, impl-2 は ready。cost: 4/7/2/12/0。**asOf=2026-01-28**:

| 指標 | 値 |
|---|---|
| EV_abs | 20 |
| EV% | 20/26 ≈ 0.769 |
| 見積カバレッジ | 5/6 ≈ 0.833 |
| スケジュールカバレッジ | 1.0 |
| PV | 20 |
| AC | 25 |
| SPI（生） | 1.00 |
| CPI | 0.80 |

## 既知の開示（MODEL §7 と一致）

- 凍結スロットは「初回スケジュール transition の不変属性」。leveler は**生きた予測のみ**を再計算し、ベースライン slot は再計算しない（PMB と EAC の分離 `MODEL:203`、P8 非決定性の回避 `MODEL:190`）。
- 平準化は発見的・非最適（P8）。本実装の貪欲充填は一つの正当な実装選択であり、実装依存を開示する。
- 木の所属と DAG 依存は別軸。最小スライスでは依存述語（R-D4）を直接の node→node 辺として扱う。
