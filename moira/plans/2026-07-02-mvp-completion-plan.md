# Moira MVP 完成計画（設計＋実装計画）

作成日: 2026-07-02 ／ 対象: [issue #5](https://github.com/PrimeBrains/sdd-workshop/issues/5)・[issue #6](https://github.com/PrimeBrains/sdd-workshop/issues/6)・D-1 done-lock・ドキュメント整合

> **【追記（同日・実装後）】本計画は同セッションで実装まで完遂した。ただし §A（detach 案）は `moira-model-update` の敵対ゲート Round 1（敵対者3体）で反証され全面撤回**——採用されたのは対抗案「**所属の latest-wins 置換**」（MODEL v20 §2.8。誤親の補償は正しい親への再 decompose 1発・多重親は表現不能・木性の保護＝循環 decompose の拒否・cost 非負）。§A は「当初案とその棄却理由の記録」として読むこと。顛末の正典記録は `moira/MODEL.md` §6 v20 来歴。B（ui ホットリロード）・C（D-1）・D（docs）・A5（add フォールバック）は計画どおり実装済み。

本文書は **次セッションがこの1本だけで実装に着手できる** 粒度の設計・タスク分解として書かれた（実装は同日完遂）。

---

## 0. スコープと実行順序

### スコープ

| # | 項目 | ゲート |
|---|---|---|
| A | issue #5: decompose 辺の補償イベント `moira detach` ＋ `moira add` の `--parent` 省略時 root フォールバック修正 | detach 本体は **moira-model-update 必須**（本文書 §A がゲート入力）。add フォールバック修正は CLI 表面のみで先行可 |
| B | issue #6: `moira ui` ホットリロード（依存ゼロ維持） | 不要 |
| C | D-1 done-lock: 完了済み合意ノードの EV_abs が再見積で消える MODEL↔実装ギャップの fold ガード修正 | 不要（正典に実装が追いつく方向のみ。I4／R-E3／moira-core Req7 AC4／D-1 批准済みで確認済み） |
| D | ドキュメント整合: ADR-0002 照読・CLI README・「ui 再起動」助言の一掃 | 不要 |

**スコープ外**: 意図的延期の導出（R-T3/T4/T6、R-S7 原因別、commit-decision、valid-time c）／CQRS 分割（roadmap の生産形）／cost 誤計上の補償（MODEL §7 開示に回す）／未コミットアダプタ作業のコミット自体。

### 実行順序の推奨

1. **先行（ゲート不要・互いに独立）**: C（D-1、fold 一点修正）→ B（#6）→ A のうち add フォールバック修正
2. **ゲート経由**: A の detach 本体 — `moira-model-update` 起動（§A.6 が最小ペイロード）→ MODEL 確定 → backend → CLI → docs
3. B と C の両方が frontend rebuild を要するため、まとめて最後に `npm run build` 1回で足りる

### ベースライン注意

- 作業ツリーに未コミットのアダプタ実装一式（`moira/cli/src/adapter/`・`moira/cli/templates/`・`errors.ts`・`.kiro/adr/0002-cc-sdd-moira-adapter.md`・README 追記）が存在する。本計画はそれを前提とする。
- `moira/cli/src/commands.ts` は modified（アダプタ配線）であり、A（cmdAdd/cmdDetach）と B（cmdUi）の両方が触る。差分は関数単位で閉じるため衝突面は小さいが、コミット順序に注意。

---

## A. Issue #5 — decompose 補償イベント `detach`

### A.1 イベント語彙 = `DecomposeEvent` に `op: 'add' | 'detach'` 判別 union（4イベント公理不変）

`moira/backend/src/types.ts`（現行 :61-66）:

```ts
// kind は 'decompose' のまま（4イベント公理不変）。op で判別する2メンバー union。
interface DecomposeAddEvent extends EventBase {
  kind: 'decompose';
  op?: 'add';                 // 省略 = 'add'（既存 events.json と後方互換）
  parent: NodeId;
  reason: string;
  children: Array<{ node: NodeId; estimate?: number }>;
}
interface DecomposeDetachEvent extends EventBase {
  kind: 'decompose';
  op: 'detach';
  parent: NodeId;
  reason: string;             // 補償イベントに理由必須が継承される
  children: Array<{ node: NodeId; estimate?: never }>; // detach は見積を運べない（型で禁止）
}
export type DecomposeEvent = DecomposeAddEvent | DecomposeDetachEvent;
```

`estimate?: never` により、union 越しの `c.estimate` 参照（`derivations/activity.ts:26`、`cli/src/commands.ts` の `hasEstimate`）が型エラーにならず、かつ detach への見積混入を型レベルで禁止できる（計器②の新しい正負アサート先）。

**棄却した対案**（ゲート提出用の比較）:

| 案 | 棄却理由 |
|---|---|
| B: relate に木辺種を追加 | MODEL §2.6「木は所属、DAG は論理依存、両者を混同しない」に正面衝突。wouldCycle（I2 は relate 全辺種対象）へ木辺が混入し循環判定の意味論再定義が必要 |
| C: 第5イベント | 公理級の破壊: §2.8「4イベント」表題・R-U2・PR-EVENTS-ONLY（agreed）・`decisions/events.test-d.ts`（kind=4種固定の CI 型ゲート、D-3 計器②資産）が全滅 |
| D: 汎用 retract-by-event-id | transition の取消は未定義、agree の取消は I4 完了施錠と矛盾。replay-with-exclusion は意味論上「過去の再解釈」＝実質の歴史編集で A2（正直な弧）を全消費者で破壊。誤り種別ごとの補償は既にほぼ揃っており（transition→前進補償遷移、estimate→latest-wins 再提案、relate→op=remove）、**欠けているのは decompose 辺だけ** — その1穴だけを塞ぐのが最小 |

reparent 原子イベントは MVP 不要（detach + add の2イベントで表現可能）。

### A.2 fold 意味論（`moira/backend/src/fold.ts` case 'decompose' :87 を op 分岐、各 child ごと）

1. **辺不存在** → `structuralErrors.push("R-D8: detach of non-existent decompose edge 'P'→'C' — rejected")` で当該 child は no-op。**detach は絶対に `ensure()` しない**（ノード非生成。未知ノード名指しも自然にここへ落ちる）。可視エラーにする根拠: 補償の狙い外しは正直に報告すべき（§2.1／P0 正直なギャップ）。既存の拒否スタイル（R-U4 :123-127、I2 :148-152）と同型。relate(op=remove) の無音 no-op（:166-176）との非対称は**意図的選択**として MODEL 段落に明記。
2. **辺除去**: `childrenOf.get(ev.parent)` から `c.node` を除去。**リストが空になったら Map エントリ自体を delete**（「一度も attach されなかった状態」と fold 状態レベルで等価。導出は全箇所 `?? []` なので DerivedState には影響しないが、より強い等価性が成り立つ）。
3. **`parent` ポインタの決定的再計算**: fold 関数内ローカル（ProjectedState には載せない）に `lastAttach: Map<child, Map<parent, seq>>` を保持。decompose-add 適用のたび `lastAttach[C][P] = seq++`（イベントは (ts,id) 順で処理されるため seq 順は全順序。**再 add は seq 更新** — 現行の `cn.parent = ev.parent` 無条件上書き＝latest-wins と厳密一致）。detach では `lastAttach[C][P]` を delete し、
   - 残 0 → `cn.parent = null`（孤児容認。`ac.ts` は forest を明示サポート済み。CLI が警告 — A.3）
   - 残 ≥1 → **残存辺のうち seq 最大（＝最後に add された辺）の親**。複数残存でも決定的。
4. **他は一切不変**: latestEstimate・estimateState・frozenBudget・frozenSlot・lifecycle・assignee/reviewer・ownCost・dependencyEdges・supersedeEdges。**detach は見積次元に不作用**（誤 add が `--estimate` 付きでも latestEstimate は戻らない — latest-wins 再提案という既存補償の管轄）と MODEL 段落に明記。
5. **後続 decompose での再 add**: 既存 add パスがそのまま機能（includes ガードで再挿入、seq 更新で parent latest-wins）。特別扱い不要。
6. **循環**: detach は辺を消すだけで循環を作れない。wouldCycle 不関与。（decompose-add 自体が木循環を未チェックなのは既存ギャップとして §7 開示、スコープ外。）

### A.3 メトリクス不変性の論拠（検証済み）

- `childrenOf` の消費者は4箇所のみ:
  1. `derivations/effective-set.ts:41` — 有効葉判定（葉集合が EV%/EV_abs/PV/estimateCoverage/scheduleCoverage/executionCoverage の共通基底）
  2. `derivations/ev.ts:40` — cumulativeEvAbs の葉判定
  3. `derivations/ac.ts:24` — AC の木積み上げ
  4. `frontend/src/surfaces/schedule/gantt-geometry.ts:101,136` — 木の DFS 描画（二重表示の発生源。root 検出は `parent == null && children > 0`）
- `ProjectedNode.parent` を読むのは frontend の root 検出のみ（backend の導出は不読、grep 全数確認済み）。
- したがって **detach は誤 add の辺構造効果を厳密に逆転**し、`childrenOf` 由来の全読みは誤り前の値へ戻る。issue の受け入れ基準「補正後 PV/coverage 不変」はこの一般定理の特殊例。
- **発見**: 二重辺は `acByNode` を二重計上させる（先祖ノードが子サブツリーのコストを2回積む。AC 合計は Σ ownCost なので無傷）。issue の「メトリクスは無傷」は当該シナリオで cost=0 だった偶然であり、一般には二重辺はメトリクスを歪める — **補償イベントの必要性を強める事実**として文書化・ゲートに提出。

### A.4 CLI

```
moira detach <child> [--from <parent>] [--reason "..."] [--actor <who>]
```

- **`--from` 推論規則**（`fold(repo.loadEvents())` して child への流入木辺を数える）:
  - 0本 → `CliError: no decompose edge into '<child>' — nothing to detach`（書き込まない）
  - 1本 → `--from` 省略可、その親を使用
  - ≥2本 → `--from` **必須**。候補列挙エラー: `ambiguous: '<child>' has parents [todo-app, task-add-and-list] — pass --from <parent>`
  - `--from` 指定で辺不存在 → 書き込み前に CLI エラー（fold も拒否するが、確実に失敗するイベントを書かない。`cmdAgree` の事前読み `hasEstimate` が前例）
  - 「root フォールバック辺を自動選択」のような推論は**採らない**（暗黙の magic がこのバグの原因。CLI は薄く正直に保つ）
- reason 既定: `moira detach ${node}`（cmdAdd と同スタイル、イベント側の reason 必須は常に満たす）
- 出力: stdout `- detach ${parent} → ${node}`（`+ decompose ...` と鏡映）。detach 後に木親 0 本になる場合は stderr 警告: `warning: '<node>' now has no tree parent — it will leave the tree display; re-attach with: moira add <node> --parent <p>`（gantt の root フィルタにより childless 孤児は木表示から消えるため。nodeStates 表には残る）
- 実装分割: 新規 `cli/src/tree.ts` に純関数 `resolveDetachFrom(state, child, explicitFrom)` / `resolveAddParent(state, node, explicitParent, projectRoot)`。`emit.ts` に `detachEvent(stamp, actor, parent, children, reason)`。`cmdLog` の `eventDetail` に detach 表示追加。USAGE 更新。
- `moira reparent`・`moira estimate` エイリアスは MVP 見送り（フォローアップ候補として記録のみ）。

### A.5 `moira add` フォールバック修正（issue #5 コメント対応・MODEL 非変更で先行可）

`cmdAdd`（`commands.ts:104-131`、root フォールバックは :116）の親決定を置換:

1. `--parent` 指定 → 現行不変。
2. `--parent` 省略 かつ ノードが fold 済み状態に存在し `parent !== null` → **現在の有効親を再利用**。stderr 注記: `note: --parent omitted — reusing existing parent '<P>' for '<node>'`。→ issue の footgun（見積再 add）は既存親下への decompose となり、includes ガードで辺は増えず latest-wins で見積のみ更新。**二重辺・二重表示は発生しなくなる**。
3. `--parent` 省略 かつ 新規ノード（または孤児）→ 従来どおり projectRoot へフォールバックするが **stderr 警告を必ず出す**: `warning: --parent omitted — attaching '<node>' under project root '<root>'`（無音フォールバックだけを廃止＝§2.1 の正直化。`moira add <feature>` の1コマンド利便性は維持）。

- `fold` は `moira-backend` barrel から export 済み → CLI から親推論に利用可能。読み→emit→append の薄い形は維持。
- moira-guard hook（`--parent` 無し add の deny）は防御多層として**残す**。

### A.6 テスト

- `backend/src/fold.test.ts` 追記7本（既存スタイル: Log ビルダー＋MODEL 引用コメント）:
  1. detach が childrenOf から辺除去（空エントリ削除）
  2. parent 再計算: `A→c, B→c`（parent=B）→ detach B→c ⇒ parent=A → detach A→c ⇒ parent=null
  3. latest-wins 整合: `A→c, B→c, A→c 再add`（parent=A）→ detach A→c ⇒ parent=B
  4. 不存在辺 detach ⇒ structuralErrors に 'R-D8'・他の状態完全不変・ノード非生成
  5. detach が latestEstimate/lifecycle/ownCost/frozen* を不変に保つ
  6. detach → 再 add で辺復活・parent 復帰
  7. detach 入りログの (ts,id) シャッフル決定性
- 新規 `backend/src/pbt/detach-properties.pbt.test.ts`（green-properties スタイル: oracle は PROPERTIES の一文から転記・非空虚 witness 必須）:
  - **PM-DETACH-INV**（メタモルフィック; A2·I3·R-D8）: ログ L、L 上の2ノード p,c で辺 p→c 未存在のとき `derive(L ++ [add(p→c, 見積なし), detach(p→c)])` ≡ `derive(L)`（activityLog を除く全フィールド深い等価。structuralErrors も不変。前提は fc.pre）
  - **PR-DETACH-REPAIR**（issue #5 シナリオ律）: feature/phase 木＋誤 root フォールバック再見積 decompose＋detach で、(a) witness: detach 前に流入木辺2本（非空虚）(b) detach 後: 流入1本・parent=feature (c) クリーンログの derive と activityLog 以外等価 (d) 誤り発生前→補正後で pv・estimateCoverage 不変（受け入れ基準の逐語転写）
  - detach 入り order-invariance 1本（arbProjectSpec 本体への detach コーナー追加は self-coverage 契約に触るためフォローアップ）
- `backend/src/decisions/events.test-d.ts` 追記: kind は依然4種（正・既存テスト緑＝D-3 不変の証明）／op = `'add' | 'detach' | undefined`（正）／detach children に estimate 値で型エラー・op に `'delete'` 不可（負）
- `cli/src/golden.test.ts` 第2 describe: 既存 TODO ログ＋誤 add（root フォールバック辺を emit で再現）＋detach ⇒ **既存スナップショットと同一数値**（EV_abs 5 / EV% 5/7 / PV 7 / AC 6 / CPI 5/6 / review queue [list-tasks]）
- 新規 `cli/src/tree.test.ts`: 純関数単体（0本エラー／1本推論／複数候補列挙／既存親再利用／root フォールバック警告文言）。fs 不要。
- `backend/src/derivations/activity.ts`: decompose case の**先頭**で op=detach を分岐（さもないと root からの detach が「フィーチャーを発見」と誤ラベル）。label 例「所属を取消（detach）」・node=ev.parent。

### A.7 正典・文書への波及（moira-model-update ゲートの最小ペイロード）

- **MODEL.md**:
  - §2.8（:147 の表）: decompose 行を「子と見積の設定/改訂**／所属辺の取消（op=detach・補償・理由必須）**」に拡張＋新段落「補償的 detach」: 辺除去・parent 決定則（残存辺の最終 add latest-wins・皆無なら親なし）・不存在辺は可視の構造エラー・見積/lifecycle/cost 次元に不作用・**補正自体が追記であり A2/I3 不変（歴史編集ではない）**
  - §4.5（:363、R-D7 の後）: **R-D8 (Event)** 新設 — 上記意味論の EARS 化
  - §5（:388 必要十分性）: 「detach は decompose 内の操作であって第5イベントではない」1文（敵対者攻撃の先回り）
  - §7 開示: (i) decompose-add の木循環未チェック（既存）(ii) cost 誤計上の補償は未提供（辺だけが補償を得た）
  - （任意）§2.6: decompose が木辺の唯一の構成子かつ（detach で）唯一の除去子
- **PROPERTIES.md**（v0.3→追記）: §A 本表に PR-DETACH-REPAIR（根拠 R-D8・A2。一文案「間違って張った“所属”の線は、歴史を消さず追記の取消で外せる。外しても出来高・予定価値・カバレッジは動かず、木の二重表示だけが消える」）、メタモルフィック表に PM-DETACH-INV、clause→property 被覆の R-D 系 7→8本・§2.8 行に2件追記
- **DECISIONS-CATALOG.md**: 新規 D エントリ（proposed・計器②③）「間違えて張った“所属”の線を、歴史を消さずにどう取り消すか」。決めたこと＝追記の補償イベント。他にありえた＝汎用取消ID／第5イベント／ログ手修正・seed 全再生。外すと＝誤辺の唯一の復旧が全ログ再生になり二重表示が放置される。裏面＝R-D8／fold.ts／計器②③。
- **ゲートに開示する制限**: **前方非互換** — detach 入りの新ログを旧バイナリの fold が読むと op 分岐が無いため **add として誤適用**し辺を逆に増やす。backend/cli は `file:` 依存で同梱配布のため MVP 許容。
- R-D8 の番号はゲートで最終確定（コード内エラー文字列・テスト・PROPERTIES 行を確定番号へ追随 — 実装を Phase 0 の後に置く理由）。

### A.8 タスク順序

| Phase | 内容 |
|---|---|
| 0 | 本 §A を入力に `moira-model-update` 起動 → MODEL §2.8/§4.5/§5/§7 パッチ確定（※A.5 の add フォールバック修正のみ先行可） |
| 1 backend | `types.ts` union 化 → `fold.ts` detach 分岐＋lastAttach 帳簿 → `activity.ts` detach ラベル → `fold.test.ts` 7本 → `pbt/detach-properties.pbt.test.ts` → `events.test-d.ts` |
| 2 CLI | `emit.ts` detachEvent → `tree.ts` 新規 → `commands.ts`（cmdDetach 新設・cmdAdd 置換・dispatch・USAGE・eventDetail）→ `golden.test.ts` 第2シナリオ → `tree.test.ts` |
| 3 docs | PROPERTIES.md・DECISIONS-CATALOG.md・cli/README.md・templates（moira-track SKILL/reference の §F 復旧手順「seed 全再生」→「moira detach」へ） |
| 4 実機 | playground で issue 再現 → detach → `moira ui` 二重表示消滅・`moira show` 数値不変を目視 |

---

## B. Issue #6 — `moira ui` ホットリロード

### B.1 二層修正（層(a)が受け入れ基準の下限を常時保証する縮退設計）

- **層(a) 毎リクエスト再構築**: `GET /` は毎回 fixture provider（ディスク再読込）を呼んで `injectFixture()` し直し＋`cache-control: no-store`（ハッシュ付き dist アセットはキャッシュ可のまま）→ **リロードで必ず最新**。
- **層(b) fs.watch → SSE ping → クライアント再取得**: 開きっぱなしのタブが自動更新。層(b)が環境要因で死んでも層(a)に静かに縮退。

### B.2 エンドポイント

| ルート | 役割 | 応答 |
|---|---|---|
| `GET /`・`/index.html` | 毎リクエスト provider → `injectFixture()` | `text/html` + `no-store` |
| `GET /api/fixture` | UiFixture をディスクから読み直して返す | `application/json` + `no-store` |
| `GET /api/stream` | SSE。**fixture 本体は載せず「changed」ping のみ** | `text/event-stream` |

SSE フレーム: `retry: 1000` 前文 → `:connected` → 変更時 `event: change` / `data: {"seq":N}`（seq はサーバ単調カウンタ、クライアント重複排除用）→ 25秒毎 `:hb` ハートビート（タイマー `unref()`）。

**ping 専用にする理由**: 大 JSON の SSE 複数行フレーミング/エスケープ回避／fixture 直列化の二重化防止／連続変更の自然な合流（ping N回 → fetch 1回で最新）／`/api/fixture` を curl で単独検証可能。**ポーリングフォールバックは作らない** — クライアントは EventSource の `open`（初回＋自動再接続時）でも refetch するので、再接続中の取りこぼしはこれで回収。fs.watch 起動不能環境では層(a)に縮退＋stderr 警告1行。

### B.3 `serveUi` 新シグネチャと内部分割（`moira/cli/src/ui-server.ts`）

```ts
export interface UiServerOptions {
  distDir: string;
  port: number;                 // 0 = OS 任せ（テスト用; url は server.address() から解決）
  fixture: () => UiFixture;     // 呼ぶたびディスクから新鮮に組む provider
  watchDir?: string;            // .moira ディレクトリ。省略時 watch なし（テスト・劣化モード）
}
export interface RunningUi {
  url: string;
  server: Server;
  notifyChange: () => void;     // debounce 済み broadcast のテスト用継ぎ目（watcher もこれを叩く）
  close: () => Promise<void>;
}
```

- 内部3部品: `createSseHub()`（クライアント Set・broadcast・closeAll — fs 無関係に単体テスト可）／`watchMoiraDir(dir, onChange, debounceMs)`／既存 `injectFixture`（純関数のまま不変）。
- **port 0 対応必須**: 現行は `localhost:${port}` の文字列組みで port 0 だと壊れる → `server.address()` から解決。
- provider 堅牢化: JSON.parse 失敗（CLI の非アトミック書き込みとの競合＝破れ読み）時は **last-good キャッシュ**を返す（stderr 警告。初回から失敗なら 500）。

### B.4 fs.watch の Windows 対応（win32 が主戦場）

- **`.moira` ディレクトリを watch**（ファイル個別 watch は atomic-replace/rename で死ぬ。ディレクトリ watch は生き残り、1 watcher で4ファイルを賄える。`recursive` 不要）。
- コールバックで `filename` を `{events,capacity,labels,config}.json` にフィルタ。**`filename` が null/undefined の場合は「変更あり」とみなす**（プラットフォームで欠落しうる — 安全側）。
- **debounce 150ms（trailing edge）**: Windows は1書き込みで change が複数回飛ぶ。`clearTimeout`+`setTimeout` 合流、タイマー `unref()`。
- `fs.watch(dir, { persistent: false }, cb)` ＋ close() で明示 `watcher.close()`（persistent:false はプロセス生存を握らない保険であり close の代替ではない）。
- `fs.watch()` は try/catch。失敗（ネットワークドライブ等）→ stderr 警告1行 → watch なし（層(a)のみ）で続行。
- 内容差分チェック（fingerprint）は v1 では行わない（無変更 ping はクライアント refetch が安価に吸収）。

### B.5 `cmdUi`（`moira/cli/src/commands.ts:282-311`）

```ts
const asOfFlag = str(values.asOf);
const provider = (): UiFixture => {
  const cfg = repo.loadConfig();
  const labels = repo.loadLabels();
  return {
    events: repo.loadEvents(),
    capacity: repo.loadCapacity(),
    asOf: asOfFlag ?? cfg.asOf ?? today(),
    nodeLabels: labels.nodeLabels,
    actorLabels: labels.actorLabels,
    live: true,
  };
};
const running = await serveUi({ distDir: dist, port, fixture: provider, watchDir: repo.dir });
```

**asOf の優先順位** = `--asOf` フラグ（起動時に固定 — ユーザーの明示契約）> `config.json` の asOf（毎回読み直し）> `today()`（毎回評価 — 日付跨ぎに追従）。config.json も watch 対象なので、config で asOf を変えると開いているタブも自動追従する。

### B.6 フロントエンド（最小差分3点）

1. **fixture に `live?: boolean`**（CLI サーバのみ true）。`ui-server.ts` の `UiFixture` と `frontend/src/main.tsx:17-23` の `MoiraFixture` に optional 追加。**Playwright fixture 継ぎ目は不変**（E2E は live を設定しない → EventSource 不作動）。デモモードは fixture 自体が無い → 同様に不作動。既存 E2E・デモに影響ゼロ。
2. **`MoiraProvider` に `replaceSnapshot(events, capacity)`**（`frontend/src/moira/store.tsx` + `context.ts`）。中身は `setEvents; setCapacityEntries;` のみ — 既存 useMemo 連鎖（fold/derive）が自動再導出（R-S2 のまま）。
3. **新規 `frontend/src/moira/live.tsx` = `LiveFixtureBridge`**（null 返しの極小コンポーネント）。main.tsx が `fixture?.live === true` のときだけ `<MoiraProvider>` の内側に `<App/>` の兄弟としてマウント:
   - mount 時 `new EventSource('/api/stream')`。`open` と `change` の両方で `/api/fixture` を `fetch(..., { cache: 'no-store' })` → `setUserLabels(fx.nodeLabels, fx.actorLabels)` → `replaceSnapshot(fx.events, fx.capacity ?? [])`
   - 単調増加カウンタで**古い fetch 応答を破棄**（out-of-order 対策）
   - unmount で `es.close()`（StrictMode 二重マウント耐性。配布 dist は production ビルドなので実運用は単一マウント）
   - **asOf ナビ保存**: ref で `lastServerAsOf` を保持し、refetch 時「現在 asOf === 前回サーバ値」なら `setAsOf(fx.asOf)` で追従、ユーザーが動かしていたら保持。asOf ロジックは Bridge に閉じる（store には足さない）。

### B.7 サーバライフサイクル

- `close()` の順序必須: ① `watcher.close()` ② heartbeat `clearInterval` ③ **全 SSE クライアント `res.end()`**（生存 SSE があると `server.close()` が返らない）④ `server.close()`。
- SSE クライアントは `Set<ServerResponse>`、`close` イベントで自動除去。バックプレッシャ: フレームは数十バイトの ping・localhost 専用 — `res.write()` 戻り値は無視してよい規模（コードコメントに明記）。

### B.8 テスト（フレーク隔離が骨子）

`cli/src/ui-server.test.ts` 拡張:

| テスト | 手法（Windows フレーク回避） |
|---|---|
| `/` 毎リクエスト再構築 | mkdtemp の極小 distDir＋可変 provider（呼び出しカウンタ）で port 0 起動 → 2回 fetch し2回目に新イベントが焼き込まれる |
| `/api/fixture` | 新鮮な JSON と no-store ヘッダ |
| SSE ハンドシェイク＋broadcast | 生 `http.get` でヘッダ・`retry:` 前文 → **fs を経由せず `running.notifyChange()` を直叩き**して `event: change` 受信確認（fs.watch をテストパスから排除＝フレークゼロ） |
| debounce | 抽出した debounce 関数を `vi.useFakeTimers()` で駆動（5連打 → 150ms 後1回だけ発火）。実 fs 不使用 |
| fs.watch 実機統合 | **1本だけ**: mkdtemp に `watchMoiraDir` → writeFileSync → onChange をポーリング待ち（timeout 5s・retry 2）。唯一フレークしうるテストとして隔離 |
| close() 清潔性 | close 後 notifyChange が no-op・ハンドルリークなし（リークすれば vitest がハング検知） |

フロント: `replaceSnapshot` 単体（derived 再計算・asOf 保持）＋ `LiveFixtureBridge`（EventSource/fetch を `vi.stubGlobal` でスタブ — change ping → 新 fixture 反映・stale 破棄・asOf 追従規則）。

**Playwright 新規 spec は作らない**（live 経路 E2E は CLI サーバ＋実ファイル書き込みが要り重い・フレーク源。fixture 継ぎ目の非破壊は既存 E2E 群が回帰網）。PR に手動スモーク手順を明記（B.10）。

### B.9 タスク順序

1. `ui-server.ts`（Options 化・再構築・/api/fixture・SSE hub・watchMoiraDir・no-store・port 0・close 清掃・last-good）
2. `commands.ts` cmdUi（provider 閉包・live・watchDir）
3. `frontend/src/main.tsx`（live フラグ・Bridge マウント）
4. `context.ts`+`store.tsx`（replaceSnapshot）
5. `frontend/src/moira/live.tsx` 新規
6. テスト（CLI → フロント → 既存 E2E 全走で継ぎ目非破壊確認）
7. `frontend` を `npm run build`（`moira ui` が配る dist の更新）
8. `cli/README.md` の ui 行に「稼働中の追記は自動反映（fs.watch→SSE）」追記 → D.3 の助言一掃へ接続

### B.10 手動スモーク手順（PR に記載）

`moira ui` 起動 → 別端末で `moira add ...` → タブが自動更新される／リロードでも最新／`--asOf` 指定起動時は日付ビューが固定のまま。

---

## C. D-1 done-lock 修正（PR-DONE-LOCK★ の RED トリップワイヤ解消）

### C.1 執行の所有権 = fold ガード（案A・正典が既に裁定済み）

- **DECISIONS-CATALOG.md D-1（agreed・2026-06-26 人間批准済）が明文**: 「これを守る責任は土台の仕組みが持ち、**完了済みの作業については見積もりのやり直し自体を受け付けない**」。読み側特例（案B: EV が完了済み+frozenBudget を数え続ける）は D-1 の「他にありえた選び方」として**明示的に棄却済みの対案**。
- `done-lock.pbt.test.ts` ヘッダのヒント（"EV_abs reads frozenBudget for completed nodes regardless…"）はこの棄却済み対案の記述であり、批准済み Decision 本文が優先する（**実装 PR にこの食い違いを一言明記**）。
- MODEL.md R-E3: 再見積は未完了ノードのみ／完了後の理解変更は supersede／「R-U13 も誤発火しない」— これは estimateState が proposed に**戻らない**ことによってのみ構造的に保証される。案B は completed+proposed 状態を残すため R-U13 偽発火で正典矛盾。
- 副作用表: 案A は fold 一点修正で全消費側（ev/EV% 分母/coverage/pv→SPI/forecast/leveler/R-U13 警告/nodeStates 表示）が不変。案B は最低6箇所の特例化＋正典矛盾2件（estimateCoverage から完了ノード脱落＝R-E3 矛盾、R-U13 偽発火）。

### C.2 コード変更（一点）

`moira/backend/src/fold.ts:138-141` の estimate-agreement else 分岐（`to !== 'agreed'`）にガード:

```ts
} else {
  // I4/R-E3 (D-1 done-lock): 完了ノードの agreed→proposed 復帰は拒否。
  // 再見積は未完了ノードのみ; 完了後の理解変更は supersede (§2.7)。
  const completed = n.lifecycle === 'implemented' || n.lifecycle === 'accepted';
  if (completed && n.estimateState === 'agreed') {
    state.structuralErrors.push(
      `I4/R-E3: re-estimation (agreed→proposed) on completed node '${ev.node}' — rejected (D-1 done-lock)`,
    );
    break; // イベントはログに残る（append-only）。fold が適用を拒むだけ — R-U4/I2 拒否と同型
  }
  n.estimateState = 'proposed';
}
```

要点: ガード条件に `estimateState === 'agreed'` を含めることで **R-U13 経路（proposed のまま完了 → 事後合意前の値更新）を塞がない**。既存の拒否パターン（R-U4 :123-127、I2 :148-152）と完全に同型 — 新機構は導入しない。

### C.3 付随変更

- `backend/src/pbt/done-lock.pbt.test.ts`: `it.fails` → `it` 昇格（:60）、ヘッダを「GREEN 回帰固定（D-1 是正済・日付）」へ、companion（:83-87「DOCUMENTS current behavior」）を「EV 不変（8のまま）＋structuralErrors に I4/R-E3 エントリ出現＋nodeStates で estimateState=agreed 維持」（拒否が黙殺でなく可視の証明）に書き換え。
- `DECISIONS-CATALOG.md`: D-1 本文のフォローアップ消化・裏面 ref（「fold.ts 完了ガード無し」）更新・被覆マップの「RED tripwire」→ 緑昇格・後続リスト項目(1)消化。
- 全スイート実走: backend → frontend は `@backend/` **ソース直 import** のため frontend unit＋E2E も → playground の `.moira/events.json` に違反パターンが無いことを `moira show` で確認（あれば structuralErrors 新出で機械検出）→ frontend rebuild。
- **moira-model-update ゲート不要**（正典側変更ゼロ: I4・R-E3・moira-core Req7 AC4・D-1 批准済みが既に規則を明文化。検証済み）。

---

## D. ドキュメント整合

1. **ADR-0002 は既に存在する**（`.kiro/adr/0002-cc-sdd-moira-adapter.md`、2026-07-02 付・status: accepted・**未追跡**）。タスクは執筆ではなく (a) 出荷済みアダプタ（install/status/drift/uninstall・manifest・templates 正本）との照読、(b) アダプタ実装一式と**一緒にコミット**して消失リスクを断つこと。
2. **`moira/cli/README.md`**: adapter 行は既に追記済み（未コミット）。残タスク = ui 行のホットリロード挙動追記（B.9-8）＋ detach 行追加＋ add フォールバック新仕様の反映（A 確定後）。
3. **「moira ui 再起動」助言の一掃**（B 完了後に必須。分散している）:
   - `moira/cli/templates/claude/hooks/moira-guard.mjs`（:15 ヘッダ・:130-135 PostToolUse 助言）
   - `moira/cli/templates/claude/skills/moira-track/SKILL.md`（:40・:59・:154・:161-162）
   - `moira/cli/templates/claude/skills/moira-track/reference.md`（§E-5 :155-158・:176。:231 の行番号引用 `commands.ts:299` は改修で必ずズレるため**安定記述に置換**。§F 復旧手順「seed 全再生」→「`moira detach`」へ — A 確定後）
   - `moira/cli/templates/kiro/steering/moira-track.md`（:23 発火表）
   - 新文言案: 「moira ui は稼働中の追記を自動反映する（fs.watch→SSE）。反映が見えない場合はブラウザをリロード（毎リクエスト最新を焼き込み）。再起動は不要」
   - **playground 設置済みコピーは手編集しない**: `moira/cli/src/adapter/version.ts` の adapterVersion を上げて `moira adapter install --force` で再設置（manifest の sha256 整合を保つ）。

---

## E. リスクノート

| リスク | 対策 |
|---|---|
| **detach 前方非互換**: detach 入り新ログを旧バイナリ fold が読むと add と誤適用（辺が逆に増える） | `file:` 同梱配布のため MVP 許容。ゲートペイロードに開示済み制限として明記 |
| `estimate?: never` の `exactOptionalPropertyTypes` 実挙動／frontend 型ミラー（vite の /@fs/ 直 import） | 実装時にコンパイルで確認（読取り調査では未実証） |
| Windows fs.watch フレーク（複数発火・filename null・ネットワークドライブ不可） | debounce 150ms・null は「変更あり」扱い・try/catch → 層(a)縮退。テストは broadcast 経路を fs から分離し実 fs テストは1本だけ retry 付き |
| 破れ読み（CLI の非アトミック書き込みと provider 読みの競合） | last-good キャッシュで応答継続 |
| D-1 ガードの波及（既存ログ/golden/デモデータに違反パターンが潜在） | structuralErrors 新出 → 全スイート実走＋playground `moira show` で機械検出 |
| 並行作業衝突（`commands.ts` は modified・A/B 両方が触る） | cmdUi/cmdDetach/cmdAdd は関数単位で閉じる。アダプタ一式のコミットを先行させる |
| R-D8 番号がゲートで変わる可能性 | コード内エラー文字列・テスト・PROPERTIES 行を確定番号へ追随（実装は Phase 0 の後） |
| adapter/drift への影響 | `kind === 'decompose'` 直スキャンは adapter 配下に無し（確認済み）。fold 経由なら detach 対応で自然に正しくなる — 実装時に drift テスト実走で確認 |

## F. 受け入れ確認（次セッションの Definition of Done）

- `cd moira/backend && npm test` — done-lock が `it` として green・detach PBT（PM-DETACH-INV / PR-DETACH-REPAIR）green・`events.test-d.ts` green（kind 4種のまま）
- `cd moira/cli && npx vitest run` — detach golden（誤り→補正でスナップショット同一）・tree.test・ui-server テスト green
- frontend unit＋既存 Playwright E2E 全走 green（fixture 継ぎ目非破壊）
- 手動スモーク:
  - **#5**: playground で issue 再現（`--parent` 無し add）→ 修正後は既存親再利用で二重辺が発生しないこと／意図的に二重辺を作り `moira detach` → `moira ui` で二重表示解消・`moira show` で数値不変
  - **#6**: `moira ui` 起動中に別端末で `moira add` → タブ自動反映＋リロードで最新（issue の受け入れ条件そのまま）
- issue #5・#6 をクローズ（本文書と実装 PR を参照）
