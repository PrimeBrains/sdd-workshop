---
id: 3
title: ログ home の解決を multi-repo 化し、アダプタを宣言的 provider 設定で汎用化する
status: accepted
date: 2026-07-04
app: moira
specs: []
requirements: []
supersedes: null
superseded_by: null
---

# ADR-0003: ログ home の解決を multi-repo 化し、アダプタを宣言的 provider 設定で汎用化する

## Context

issue #14: 大規模プロジェクトの実態は**多リポジトリ**（同一 BL でも設計は repo A・実装は repo B）で、
Moira のイベントログは**プロジェクトに 1 箇所**に置きたい。しかし現行 CLI はログ置場が
`process.cwd()/.moira` 固定（`store.ts` / `requireRepo`）で、作業リポジトリ＝ログ置場が
1:1 に癒着していた。またアダプタは ADR-0002 で「cc-sdd 語彙は provider に閉じる」構造を得たものの、
発火検知（`moira-fire.mjs`）のトリガー規則は cc-sdd ハードコードのままで、
プロジェクトごとに異なるプロセス・成果物には対応できない。

ユーザー決定（issue #14 計画コメント）: **汎用 provider 生成（宣言的設定）**＋
**multi-repo ログ解決**を段階的に実装する。DECISIONS-CATALOG **D-50**
（複数プロジェクトの容量集計はスコープ外・単一プロジェクトビュー）は不変 —
**multi-repo ≠ multi-project**（1 プロジェクトのログを複数の作業リポジトリが共有するだけ）。

## Decision

3 ステージに分けて段階着地する（各ステージ単独でリリース可能）。

### Stage 1（本 ADR で実装済み）— ログ home の解決機構

全コマンド共通の解決順序:

1. **`moira --dir <log-home> <command> …`** — グローバルフラグ（コマンド語の**前**のみ。
   adapter サブコマンドの `--dir <work-repo>` とは別物で共存する — `git -C` 方式）。
   フラグ > 環境変数の順序は CLI 慣習（git の `--git-dir` > `GIT_DIR`）に従う。
2. **`MOIRA_DIR` 環境変数** — CI・一時利用向け。
3. **`.moira` ポインタファイル / 上位探索** — 作業リポジトリ直下の `.moira` が
   **ディレクトリでなく通常ファイル**のとき、1 行目 `home: <path>`（相対はポインタ置き場基準）が
   home のルートを指す（git の `gitdir:` ファイルの類推）。**1 ホップのみ**（ループ防止・
   指し先がまたポインタなら明示エラー）。無ければ上位ディレクトリを git 式に探索。
4. カレントディレクトリ（従来動作 — **何も設定しなければバイト同一**）。

付随の決定:

- `moira init` は上位探索**しない**（git init の入れ子意味論）: 対象 = `--dir` > `MOIRA_DIR` > cwd。
  ポインタファイル上の init は明示エラー。
- `moira adapter drift` は **2 ディレクトリに分離**: `.kiro` 側 = 作業リポジトリ
  （adapter `--dir`）、`.moira` 側 = ログ home（上記解決・探索起点は作業リポジトリ）。
  `ignoreFeatures`/`ignoreNodes`（`.moira/adapter.json`）は home 側から読む。
- hooks（`moira-guard.mjs` / `moira-fire.mjs`）は**自前の複製ヘルパ**で home を解決する
  （各 .mjs は自己完結・依存ゼロ・fail-open を維持。import で共有しない）。ただし hooks 側は
  **MOIRA_DIR → ローカル `.moira` → ポインタ（1 ホップ）のみで上位探索をしない**（CLI との意図的な
  非対称 — hooks はホットパスで安価・fail-soft に徹し、深い探索は CLI 側に置く。ポインタ無しの
  入れ子作業ディレクトリでは SessionStart の drift 注入が黙って発火しないが、CLI コマンド自体は
  home を見つける）。
- 実装: `cli/src/home.ts` `resolveMoiraHome()`（純関数・`home.test.ts` で網羅）。

### Stage 2（実装済み）— 宣言的 provider 設定＋汎用エンジン

作業リポジトリの `.claude/moira-provider.json`（schemaVersion / detect / triggers
〔pathPattern 名前付き捕獲・read: json|checkbox|none・極小 when-DSL〕/ phases / nodeScheme /
edges / scope.claim / drift.mode）を汎用エンジンが解釈する。drift は 3 モード:
`builtin`（cc-sdd はコード provider のまま委譲＝golden 不変）／`presence`（artifact 存在→
ノード存在の宣言的最小形）／`unsupported`（明示エラー＝**drift は捏造しない**）。
`moira-fire.mjs` は設定駆動化し、設定不在時は EMBEDDED_DEFAULT（cc-sdd）へフォールバック
（テンプレ JSON とのロックステップテストで二重管理のズレを falsifiable に）。
SKILL.md は汎用 1 枚＋プロジェクト別参照の決定的レンダリング（`render.ts`）。

### Stage 3（実装済み）— 生成スキル `moira-adapter-gen`

本体リポジトリの authoring スキル（**配布物にしない**）。インタビュー（repo 一覧と役割・
フェーズ完了 artifact・feature ID 抽出と `scope.claim`・5 人間判断の割当 等）→ provider 設定を
生成 → `moira adapter validate-provider` で機械検証 → 各作業リポジトリへ
`install --provider <cfg> --home <log-home>`（`--home` はポインタファイルを書く。
manifest には載せない — 環境依存パスのため）。

## Consequences

- （+）多リポジトリの実案件で「ログは 1 箇所・作業はどこからでも」が成立する。
  単一リポの既定挙動は**バイト同一**（未指定世界は golden・既存テストで固定）。
- （+）hooks も同じ解決を持つため、作業リポジトリからのセッション開始 drift 注入・
  guard の root 表示が multi-repo でも正しく効く。
- （+）解決系はどの経路でも **home を 1 つ**しか返さない（D-50 境界の構造的保証 —
  複数 home のマージ・集計 API は存在しない）。
- （−・受容）`MOIRA_DIR` はシェル常設だとプロジェクト切替時の誤爆リスク → 常用は
  ポインタファイル、env は CI/一時用と README に明記。
- （−・受容）ポインタの絶対パスは clone 位置依存 → 相対パス推奨（絶対パスはコミットしない）。
- （−・受容）hooks の POSIX シェル前提（ADR-0002 既知）は不変。Windows ネイティブ shell 対応は射程外。
- （−・受容）非 cc-sdd の drift は Stage 2 でも presence（存在検知）どまり — lifecycle 追従の
  正規化は provider コードを書いた方法論のみ。「非対応/存在検知のみ」を正直に宣言する設計。
- （フォローアップ）Stage 2 の SKILL 汎用化・Stage 3 のスキル執筆は doc-refine ゲート
  （高能力モデル＋Opus 検証ループ）で再凍結する（Stage 2 は 2R PASS 済み）。
- （将来改善）custom provider の `provider-reference.md` は設定由来のレンダリング節
  （§P1/§P3/§P4）と手書きの振り付け節（§P2）が同一 managed file に同居する — §P2 を手編集すると
  以後の install はファイル全体を skip し、設定変更の再レンダリングには `--force`（手書き部は
  .bak 退避→貼り戻し）が要る。手書き部の別ファイル分離は将来の改善候補。

## Alternatives

- **ログを各リポジトリに分散し read 時にマージ** — I3（大域順序）と D-50 を侵食し、
  二重投入・重複ノードの照合問題を新設する。棄却。
- **設定ファイル（config.json）に homePath を書く** — config.json 自体が home 側にあるため
  自己言及になる。作業リポジトリ側に置く軽量ポインタ（`.moira` ファイル）が最小。棄却。
- **env のみ（フラグ・ポインタなし）** — リポジトリに可搬な設定が残らず、セッション毎に
  張り直しが必要。誤爆リスクも高い。ポインタを主・env を従とする。棄却。
- **`--dir` を全サブコマンドの個別フラグとして増殖** — adapter `--dir`（作業リポジトリの意味）と
  衝突し、コマンドごとに解釈が割れる。グローバル位置（コマンド語の前）に固定。棄却。
