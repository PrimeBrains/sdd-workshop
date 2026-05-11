# Product Overview

EVM Studio は、プロジェクトの WBS を取り込んで進捗を記録し、EVM（Earned Value Management）メトリクスをリアルタイムで可視化するローカル Web アプリケーション。

## Core Capabilities

- **WBS インポート**: wbs-* スキルが生成した YAML（tasks / staffing / schedule）をプロジェクトデータとして取り込む
- **進捗記録**: タスクごとの実績工数・完了率を日次で入力・管理する
- **EVM 計算**: PV / EV / AC / SPI / CPI / EAC をリアルタイムで算出する
- **ダッシュボード**: SPI トレンド・アラート・遅延タスク一覧・EVM サマリーを可視化する
- **レポート出力**: 朝報スタイルの EVM サマリーを生成する

## Target Use Cases

- プロジェクトマネージャーが週次・日次で SPI を確認し、遅延リスクを早期検知する
- チームリーダーが担当者ごとの稼働状況と完了率を一元管理する
- 複数プロジェクトの EVM メトリクスを横断比較する

## Value Proposition

Excel + VBA の EVM 管理ツールをサーバーレス Web アプリに置き換える。クラウドインフラ不要で `npm start` だけで起動でき、インターネット環境がない現場でも動作する。
