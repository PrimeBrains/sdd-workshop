# Brief: task-add-and-list

## Problem
1人のユーザーが、頭の中にある「やること」を書き留めて見返す手段がない。紙やメモアプリに散らばると、
いま何が残っているのかを一覧で把握できず、抜け漏れが起きる。

## Current State
リポジトリは spec としてはグリーンフィールド（`.kiro/specs/` は空、実装コードもまだない）。
steering `product.md` に「ごくシンプルな TODO を cc-sdd フローで作り Moira 可視化を体験する」という
プロダクト意図だけが確定している。技術スタックは未定だった。

## Desired Outcome
- ユーザーがタスクのタイトルを入力して**追加**できる。
- 追加したタスクが**一覧**に（追加順で）表示される。
- ページを再読み込みしても一覧が保持される（localStorage 永続化）。

## Approach
**Vanilla TypeScript + Vite + localStorage** の最小構成。フレームワークを入れず、DOM を直接操作する
薄い UI と、localStorage を単一の永続化層として使う。ビルドが速く依存が最小なので、
「動く TODO」より **cc-sdd フローと Moira 可視化の体験**に集中できる（steering の目的に合致）。

## Scope
- **In**: タスクの追加（タイトル必須・任意で期限は将来拡張）、未完了タスクの一覧表示（追加順）、localStorage への永続化。
- **Out**: 完了/取消、削除、期限、認証、共有、通知、モバイル、本番デプロイ。これらは後続スペックへ。

## Boundary Candidates
- **ドメイン層**: タスクのモデル（id / title / createdAt）と、追加・一覧のロジック（純粋関数・永続化非依存）。
- **永続化層**: localStorage への読み書き（load/save）。ドメインから分離してテスト可能に。
- **UI 層**: 入力フォーム＋リスト描画の DOM 操作。ドメイン層を呼ぶだけの薄い層。

## Out of Boundary
- タスクの状態遷移（完了・取消）や削除は、この spec が所有しない（次スペック `task-complete` / `task-delete` 想定）。
- 期限・並べ替え・フィルタも本スペック外。
- 複数ユーザー・同期・サーバー永続化は Out（single-user local のみ）。

## Upstream / Downstream
- **Upstream**: なし（最初の縦スライス）。steering `product.md` のプロダクト定義にのみ依存。
- **Downstream**: 後続の「完了/取消」「削除」「期限」スペックが、本スペックのドメインモデル・永続化層を再利用する見込み。

## Existing Spec Touchpoints
- **Extends**: なし（新規）。
- **Adjacent**: なし（現状 specs は空）。将来の task-complete / task-delete と、ドメインモデル・永続化層で隣接する。

## Constraints
- 技術: Vanilla TypeScript + Vite + localStorage（軽量・ローカル単一ユーザー）。
- 動作: ブラウザのローカル動作のみ。サーバー・認証なし。
- 目的優先: 実装の作り込みより cc-sdd フローの通しと Moira 可視化を優先し、スコープを小さく保つ。
