# SDD Dashboard — walking skeleton

スペック（sdd-core / sdd-review-ui / sdd-workflow-ui）のレビュー用に画面イメージを確認するための**ウォーキングスケルトン**。
このリポジトリの `.kiro/` を実際に読んで表示する。実装はペラペラ（regex パース・SSE なし・書込なし）で、本実装で全面的に置き換える前提。

## 起動

```bash
cd sdd-dashboard
npm install
npm run dev
# → http://localhost:5180 （API: 7411）
```

## 画面と対応スペック

| 画面 | 対応スペック | スケルトンで見えるもの |
|---|---|---|
| パイプラインボード | sdd-workflow-ui Req 1 | 全8スペックのフェーズ×承認状態レーン |
| スペックレビュー | sdd-review-ui Req 1-2 | Requirements 構造化カード（EARS+和訳）、design 目次+raw、tasks チェックリスト |
| AC チップクリック → トレーサビリティ | sdd-review-ui Req 3-4 | Req⇄Design⇄Task のカバレッジマトリクス、未カバー/リンク切れ検出、旧範囲表記の後方互換展開 |
| 承認/手戻りボタン | sdd-workflow-ui Req 2-3 | 確認ダイアログ+影響可視化（書込はスタブ） |
| ステアリング / スキル(EN/JA) / ADR | sdd-workflow-ui Req 5-7 | 実ファイルの一覧+閲覧、ADR ステータスバッジ |
| cc-sdd とは | sdd-workflow-ui Req 4 | フロー図+レビュー観点ガイド |

## 本実装との差分（スケルトンの手抜き）

- パースは regex（本実装: remark/mdast + position 情報）
- SSE / chokidar なし（手動リロード）
- 書込 API なし（承認・手戻りは alert のスタブ）
- サイドバイサイド比較・相互リンクの逆方向ジャンプは未実装
- フロー可視化は CSS（本実装: @xyflow/react）
