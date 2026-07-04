# moira アダプタ生成インタビュー（記入テンプレート）

`moira-adapter-gen` スキルの入力。全項目を埋めて渡すか、空欄のまま渡して対話で埋める。
【】内は cc-sdd 相当の記入例。

## 1. プロジェクト

- プロジェクト名（表示用）:
- projectRoot ID（ノード木の根・英数）: 【todo-app】
- me（あなたの担当者 ID）: 【nakao】

## 2. ログ home（1 プロジェクトに 1 つだけ — 複数プロジェクトの合算は不可・D-50）

- home の場所（既存 `.moira` のあるディレクトリ or 新規に作る場所）:
- 既存 / 新規:

## 3. 参加リポジトリ（作業が起きる場所すべて）

| リポジトリのパス | 役割（設計/実装/…） | home への相対パス（ポインタに書く値） |
|---|---|---|
|  |  | 【../project-home】 |
|  |  |  |

## 4. フェーズ語彙と「完了を示す成果物」

phases（`/moira-track <phase>` の語彙。**sync も忘れずに含める** — 自動付与は無い）:
【discovery, estimate, requirements, design, tasks, estimate-impl, impl, sync】

- この方法論が存在する印のパス（`detect` — いずれか存在すれば provider 有効。リポジトリごと）:
  【設計repo: `docs` ／ 実装repo: `src`】

| フェーズ | 完了を示すファイル（リポジトリ＋パス正規表現・`(?<feature>…)` 必須） | 判定方法（存在 / JSON フィールド〔真になる dotted path も書く〕 / チェックボックス） | 存在すべきノード（drift presence 用・`{feature}` 置換可・親も） |
|---|---|---|---|
| 【design】 | 【設計repo: `(?:^|/)docs/(?<feature>[^/]+)/design\.md$`】 | 【存在】 | 【`{feature}`（親=root）・`{feature}/design`（親=`{feature}`）】 |
|  |  |  |  |

## 5. feature ID の抽出とリポジトリ間の住み分け

- feature ID はパスのどこに現れるか（named capture `(?<feature>…)` で書けるか）:
- 各リポジトリが主張する feature 空間（`scope.claim`。**他リポジトリのノードを drift の
  ノイズにしないための宣言**）。構文は **`<id>` 完全一致 か `<prefix>/*`（末尾のみ）** の2種だけ —
  中間ワイルドカード（`backend-*/…` 等）は**使えない**。feature 単位で列挙する:

| リポジトリ | claim |
|---|---|
|  | 【`backend-auth`, `backend-auth/*`, `backend-billing`, `backend-billing/*` のように feature ごと】 |

- 同一 BL を複数リポジトリで扱う場合、どのリポジトリがどのフェーズ子を持つか:

## 6. ノード ID スキーム

- フェーズ子（`<feature>/<suffix>`）: 【req=要件定義 / design=設計 / tasks=タスク分解】
- 実装ノードの接頭辞（implPrefix）: 【impl-】
- 実装レビューノード（reviewNode・無しでも可）: 【review-impl】

## 7. 5 人間判断の割当（誰が承認するか）

| 判断 | 承認者 |
|---|---|
| ①見積合意（agree） |  |
| ②割当（assign・reviewer 指名） |  |
| ③スコープ/期日・目標日 |  |
| ④見積の深さ（分解粒度） |  |
| ⑤容量 c の宣言（capacity） |  |

## 8. 標準依存辺

- cc-sdd 4 辺既定（req→design / design→tasks = accepted・tasks→impl-* = accepted・
  impl-*→review-impl = implemented）をそのまま使う / カスタム:
- カスタムの場合（policy は accepted | implemented を明示）:

| from | to | policy |
|---|---|---|
|  |  |  |

## 9. drift モード

- [ ] `presence` — 上記 4 の成果物の**存在**からノードの存在だけを期待（推奨の最小形）
- [ ] `unsupported` — 成果物→ノード状態の対応を宣言しない（drift は明示エラー・発火規約と hooks が防衛線）
- [ ] `builtin: cc-sdd` — プロセスが cc-sdd そのもの（この場合は生成でなく既定 install で足りる可能性が高い）
