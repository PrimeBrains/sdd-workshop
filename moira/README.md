# Moira

**Moira(モイラ)** — 仕様駆動(Spec-Driven) × チケット駆動(Ticket-Driven) × EVM を一つに統合する
プロジェクト管理基盤。アーキテクチャ以前の「思想の確定」(正典モデル)から、それを縦に貫く
**動く参照実装**(バックエンド＋フロントエンド)までを一つに収めたワークスペースです。

> **一文定義** — プロジェクトとは、見積を持つノードの木とポリシー付きの辺で結ばれた DAG の上を
> 流れる4種の追記専用イベント列であり、進捗・スケジュール・健全性はすべてその導出である。
> システムは観測・導出・警告に徹し、コミットメントを伴う判断(見積の合意・割当・スコープ/期日・
> 目標日の決定・見積の深さ・容量 c の宣言——§2.1 の五判断)は人間に残す。

名前の由来は μοῖρα「割り当てられた持ち分」= Earned Value / 予算配賦。運命の三女神が三射影
(クロト=分解・計画／ラケシス=進捗測定・割当／アトロポス=完了・取消)に対応する。→ [`NAMING.md`](./NAMING.md)

> **🚀 Moira を自分のプロジェクトに導入したい方へ** — まずは [`GETTING-STARTED.md`](./GETTING-STARTED.md) から。
> 何ができるか・インストール手順・対応ユースケース・進捗管理の仕組みを、Moira を知らない前提でまとめています。

---

## Moira とは何か

ふつうの管理ツールは、進捗・スケジュール・健全性を**人間が手で入力・更新する別々の状態**として持ち、
それらの間で整合が崩れる。Moira はその前提を捨て、次の不変条件を中核に置く:

- **単一実体** — 存在するのは spec とその分解である**ノード**だけ。チケットは読み出し専用の射影。
- **単一データ** — 唯一の真実源は**追記専用の4イベントログ**(`transition` / `decompose` / `relate` / `cost`)。
  状態を直接書き換えることはできず、すべては**イベントからの導出(fold)**で得る。
- **観測と判断の分離** — システムは観測・導出・警告に徹する。数字を動かす規則は強制するが、
  コミットメントを伴う**五つの判断**(見積の合意・割当・スコープ/期日/目標日の決定・見積の深さ・
  容量 c の宣言)は人間に残す。
- **単一希少資源は人間** — 各人間の日次容量 `c(i,d) ∈ [0, 1.0] MD/日` の上で平準化し、
  EV/PV/SPI/CPI と「生きた予測スケジュール」を導出する。

正典モデルは [`MODEL.md`](./MODEL.md) を**単一の真実源(SSOT)**とする。現在の版は **v20**
(所属〔どの親の子か〕を latest-wins の置き換えとして確定し、木性ガード・cost 非負を正典化した版。
issue #5 起点)で、独立した敵対者による falsifiable な確定ゲート(独立採点者の残存
Critical/Important = 0)を通って確定している。

---

## リポジトリ構成

```
moira/
├── MODEL.md                  # 正典モデル(SSOT)。公理・4イベント・不変条件・原理・EARS 要件・来歴
├── NAMING.md                 # 名称と由来(専門家レビュー済み)
├── DECISIONS.md              # 意思決定ジャーナル(確定済み分岐・未解決論点・次の一手)
├── DECISIONS-CATALOG.md      # 設計判断の目録(D-1〜)と裏面 ref・計器割付
├── PROPERTIES.md             # 不変条件のプロパティ化(PBT/モデル検査の供給源)
├── validation-scenarios.md   # 検証シナリオ S1–S15(MODEL が「使えるか」の検分)
├── UI-ARCHITECTURE.md        # 画面アーキの橋渡し設計(導出×警告→サーフェス被覆表)
├── UI-DESIGN-BRIEF.md        # UI の設計趣旨(役割=同一導出へのフィルタ 等)
├── PROTOTYPE-EVALUATION.md   # 旧プロトを正典に照らした評価
├── thought-experiments/      # 思想を鍛えた思考実験 01–11 + FINDINGS.md
├── ui-mockups/               # UI-ARCHITECTURE の自己完結 HTML モックアップ
├── backend/                  # 参照実装: 追記専用ログ → fold 導出エンジン → 薄い read 口(純TS)
└── frontend/                 # 参照実装: backend の derive() を唯一の真実源にした React ダッシュボード
```

正典に隣接する成果物はリポジトリ上位にもある:

- [`../.kiro/specs/moira-*`](../.kiro/specs/) — MODEL を本番へ落とす **CQRS 分解の読(導出)側 spec ×10**
- [`../.kiro/scenarios/`](../.kiro/scenarios/) — 人間がレビューする**受け入れシナリオ**(ユニット＋通しフロー)
- [`../.kiro/steering/roadmap.md`](../.kiro/steering/roadmap.md) — CQRS 分解(読 spec×10 ／書 skill×14)のロードマップ

---

## 参照実装(動くプロトタイプ)

正典モデルの背骨——**追記専用4イベントログを唯一の真実源とし、fold で全導出する**——を、
バックエンドとフロントエンドが**同一の `derive()` 実装**を共有して実証する(導出は一つしかない / R-S2)。

```
イベントログ(4種, 追記専用) ──fold──▶ ProjectedState ──derive──▶ DerivedState(11導出) ──read──▶ CLI / HTTP / React UI
        + c(i,d) 第二層 ───────────────────────────────────────┘
```

### backend — 導出エンジン([`backend/`](./backend/))

純 TypeScript の縦スライス。SDD ドキュメントも DB も持たず、純関数の導出エンジン＋追記専用ログ
(メモリ/JSON)＋薄い read 口だけで構成する。`fold.ts` が `(ts, id)` 順の決定的畳み込み(循環 relate
拒否・エージェント合意拒否)を行い、`derivations/*` が各導出を純関数で計算する。詳細は
[`backend/README.md`](./backend/README.md)。

### frontend — read ダッシュボード([`frontend/`](./frontend/))

Vite + React 19 + TypeScript。**backend の `src/derive.ts` を直接 import** して、ブラウザ内で
同じ導出を回す(単一の真実源)。役割(管理者/開発者)は別アプリではなく、**同一導出へのプリセット/
フィルタ**。基準日(asOf)を変えると全サーフェスが再導出される。サーフェスは2層に分かれる:

| 層 | サーフェス | 軸 |
|---|---|---|
| 層A read ダッシュボード | `spec-value` / `schedule-time` / `activity` / `health` | 仕様・価値／スケジュール・時間／活動履歴／健全性・EVM |
| 層B 非ダッシュボード | `decision インボックス` / `capacity · calendar` | 横断・行為／config・c(i,d) |

> 起動時は同梱の demo データで動く。Playwright の E2E は `window.__MOIRA_FIXTURE__` 経由で
> シナリオのイベント列を注入して決定的に検証する([`frontend/src/main.tsx`](./frontend/src/main.tsx))。

---

## インストール

### 前提

- **Node.js 20 以上**
- npm(Node 同梱)
- リポジトリのクローン済みチェックアウト

```bash
git clone https://github.com/PrimeBrains/sdd-workshop.git
cd sdd-workshop/moira
```

backend と frontend は**独立した npm パッケージ**で、それぞれで依存をインストールする
(frontend は backend の **ソース**を直接読むが、ビルド済み backend のインストールは不要)。

```bash
# 導出エンジン(backend)
cd backend && npm install

# ダッシュボード(frontend)
cd ../frontend && npm install
```

---

## 使い方

### 自分のリポジトリで使う(moira CLI) ★

`moira` CLI を使うと、**任意のリポジトリ**に `.moira/`(追記専用イベントログ)を作り、進捗を記録し、
EVM 導出とダッシュボードを起動できる(レジストリ公開不要)。手順とコマンド一覧は
[`cli/README.md`](./cli/README.md)。設計意図(write=skill)との関係は
[ADR-0001](../.kiro/adr/0001-moira-cli-write-path.md)。

```bash
# 1度だけ(sdd-workshop 内): backend/frontend をビルド → CLI を npm link
cd moira/backend && npm install && npm run build
cd ../frontend && npm install && npm run build
cd ../cli && npm install && npm run build && npm link   # → グローバル `moira`

# 任意のリポジトリで
cd /path/to/my-todo-app
moira init --me me --label "TODO アプリ"
moira add add-task --estimate 3 ; moira agree add-task ; moira assign add-task --to me
moira start add-task ; moira done add-task ; moira accept add-task ; moira cost add-task 4
moira show     # ターミナルに EVM 導出
moira ui       # ブラウザでダッシュボード(自分のログ)
```

cc-sdd の開発フロー(`/kiro-discovery` → … → `/kiro-impl`)を回すだけで Moira が自然に埋まる体験は、
検証用 playground [`examples/todo-playground/`](./examples/todo-playground/) で用意している。

### backend — 導出を確かめる / read 口を立てる

```bash
cd moira/backend

npm test                          # Vitest 全テスト(golden が手計算値と一致 / PBT / 型テスト)
npm run snapshot                  # 同梱 golden fixture の導出スナップショットを出力
npm run snapshot -- --asOf 2026-01-15   # 任意の基準日で導出
npm run serve                     # 任意: read-only HTTP — GET http://localhost:3002/derived?asOf=2026-01-28
```

代表的な導出(asOf=2026-01-28, 同梱 golden fixture): `EV_abs=20` / `EV%≈0.769` / `PV=20` /
`AC=25` / `SPI=1.00` / `CPI=0.80`。検証の核心は2つのペア読み——`EV% ↔ 見積カバレッジ`(R-S4) と
`SPI ↔ スケジュールカバレッジ`(R-S6)。エンジンは生の指標とカバレッジを返し、デレートは提示層に委ねる。

### frontend — ダッシュボードを開く

```bash
cd moira/frontend

npm run dev          # 開発サーバ → http://localhost:5180
npm run build        # 型チェック + 本番ビルド
npm run check        # typecheck + lint + unit test を一括
npm test             # Vitest(レンダリング/忠実度/導出 golden)
npm run test:e2e     # Playwright E2E(初回は `npx playwright install` が必要)
```

ブラウザで `http://localhost:5180` を開くと、左レールでサーフェスを切り替え、上部で
**役割プリセット(管理者/開発者)**と**基準日**を変更できる。すべての画面は単一の `DerivedState`
の射影なので、同じデータが矛盾なく複数視点で見える。

---

## このワークスペースの磨き方(方法論)

MODEL.md は「書いた本人が満足したらコミット」しない。**独立した敵対者による falsifiable な
確定ゲート**を通してからのみ確定する:

1. **思考実験 / ユーザー判断 / 発見された欠陥**から変更を起こす
2. [`moira-model-update`](../.claude/skills/moira-model-update/) スキルを起動(Opus 4.8+ / effort max 推奨)
3. 独立敵対者(`moira-adversary`)が並列で穴を出す → genuine な分岐はユーザーに質問 →
   事実主張は `moira-fact-checker` で裏取り → 主コンテキストがパッチ → 独立採点者
   (`moira-gate-judge`)が「残存 Critical/Important = 0」を判定
4. 通過後、MODEL.md をその場で確定・版を上げ・§6 来歴を追記
5. 解消した分岐を [`DECISIONS.md`](./DECISIONS.md) に追記

正典の**外的妥当性**は別ループで担保する。人間が「ふるまい(When/Then)」を起こし、`kiro-scenario`
が現実(spec / MODEL / 参照実装)へ接地して受け入れシナリオ単位
([`../.kiro/scenarios/units/`](../.kiro/scenarios/units/))に描き起こし、敵対者ループで draft→agreed
に確定する。確定したユニットは `kiro-scenario-flow` で通しフローに合成され、`kiro-scenario-e2e` で
Playwright E2E に落ちる。

**品質ゲートは3器の自動検証**で支える:

- **PBT(プロパティベーステスト)** — `backend/src/pbt/*.pbt.test.ts`(fast-check)が不変条件を反証で攻める
- **境界モデル検査 / golden** — `*.golden.test.ts` が手計算値との一致を固定
- **E2E・シナリオ回帰** — `frontend/e2e/` の Playwright が agreed シナリオを回帰固定する

加えて `dependency-cruiser`(計器①)が循環依存と層境界を、`decision-conformance`(計器⑥)が
設計判断↔実装の整合を照合する。

---

## SDD への接続(進行中)

正典モデルを本番アーキテクチャへ落とす **CQRS 分解**が `/kiro-discovery`(Path D)＋ doc-refine
敵対ゲートで確定し、[`../.kiro/steering/roadmap.md`](../.kiro/steering/roadmap.md) に記録済み:

- **読/導出 = 読 spec ×10** … [`../.kiro/specs/moira-*`](../.kiro/specs/)(常駐ダッシュボードの導出機能)
- **書/オペ = 書 skill ×14** … `.claude/skills/moira-*`(イベント発行・オーケストレーション・バッチ・射影。順次整備)

分解がモデルに触れる論点は `moira-model-update` の **Phase 0** で先に決着済み。
既存の `evm-studio` / `sdd-dashboard` は使い捨てプロトタイプ実験であり、Moira はその失敗を踏まえた
完全新規・別概念。`moira/backend`・`moira/frontend` はそのフォワード本番の参照実装である。
