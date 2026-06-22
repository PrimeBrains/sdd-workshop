# 上乗せ成果物の規約 (spec-deliverables)

cc-sdd 標準の成果物に上乗せして生成する「人間向け早わかり要約」等の規約を定義する。
各セクションは独立した追記単位であり、**末尾に追記**して使う(既存セクションの上書き禁止)。
出力は各フェーズを実行するフロー(通常 Claude)が本規約に従って自動で行う(人手は本規約の初回設定のみ)。

各成果物は spec-viewer ダッシュボードの「早わかり」タブ等で表示される
(`.kiro/specs/{feature}/` 直下の固定ファイル名を読み取る)。

## requirements-summary.md(要件早わかり要約)

requirements フェーズを実行したら、requirements.md に加えて
`.kiro/specs/{feature}/requirements-summary.md`(人間向け早わかり要約)を出力する。
出力は requirements フェーズを実行するフロー(通常 Claude)が本規約に従って自動で行う(人手不要)。
人手が要るのはこの規約の初回設定のみ。

- 目的: レビュー担当者が要件本文(EARS)を読む前に全体像を把握できるようにする
- 内容: 機能の目的・主要な要件の要点・スコープ(やること/やらないこと)を簡潔にまとめる
- 体裁: 人間向けの平易な日本語。詳細は requirements.md 本文へ誘導する

## design-summary.md(設計早わかり要約)

design フェーズを実行したら、design.md に加えて
`.kiro/specs/{feature}/design-summary.md`(人間向け早わかり要約)を出力する。
出力は design フェーズを実行するフロー(通常 Claude)が本規約に従って自動で行う(人手不要)。
人手が要るのはこの規約の初回設定のみ。

- 目的: 設計レビューの入口として、design.md 本文を読む前に判断材料を揃える
- 内容: 全体像・主要な設計判断(なぜその構成か)・画面/API の対応・図(構成図等)
- 体裁: requirements-summary.md と同形式の人間向けの平易な日本語

## openapi.yaml(API 定義)

design フェーズで設計が REST/HTTP API を定義する場合のみ、design.md に加えて
`.kiro/specs/{feature}/openapi.yaml` を OpenAPI 3.1 で出力する(API を持たない機能では省略)。
出力は design フェーズを実行するフロー(通常 Claude)が本規約に従って自動で行う(人手不要)。
人手が要るのはこの規約の初回設定のみ。

- 形式: OpenAPI 3.1
- 内容: 設計が定義する全エンドポイントと schema を記載する
- 適用条件: 設計が REST/HTTP API を定義する場合のみ(持たない機能では出力しない)
