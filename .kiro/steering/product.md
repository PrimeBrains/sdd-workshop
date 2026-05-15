# Product Overview

EVM Studio は、プロジェクトの WBS を取り込んで進捗を記録し、EVM（Earned Value Management）メトリクスをリアルタイムで可視化するローカル Web アプリケーション。

UI は単一の「ワークベンチ型ダッシュボード」（モックアップ `mockup/variation-a.jsx`）で構成し、プロジェクト切替・タスク選択・進捗入力・全画面分析をワンページ内のモーダル/サブパネルで完結させる。

## Core Capabilities

### データ取り込み・管理
- **WBS インポート**: wbs-* スキルが生成した YAML（tasks / staffing / schedule）をプロジェクトデータとして取り込む
- **複数プロジェクト管理**: 左レールから常時5〜N件のプロジェクトを切り替え可能。各プロジェクトに `status (active / paused / draft / archived)` を持つ
- **メンバー管理**: プロジェクトごとの担当者一覧を左レールに常時表示

### 進捗記録
- **モーダル進捗入力**: GanttFullscreen 内のサブパネルで、対象タスクの「スナップショット日付（過去日も可）/ 進捗率 / 本日のAC追加 / メモ」を入力
- **計画線マーカー**: 進捗バーに「今日の計画 %」マーカーを重ね、計画との差分（先行/遅延）を即時表示
- **AC単位切替**: MD（人日）/ h（時間） のトグル
- **過去日付スナップショット**: BASE_DATE 未満の日付を選択でき、警告色で過去日として表示

### EVM 計算
- **コアメトリクス**: PV / EV / AC / SPI / CPI / EAC / VAC / ETC / TCPI をリアルタイムで算出
- **前日比 (compareMode)**: SPI / CPI / EV / PV / AC / VAC を前営業日との差分（▲▼ / ±0 / 符号付き MD）で表示
- **担当者別 EVM**: assignees (id, name, bac, ev, pv, ac, spi, cpi, status) を集計
- **アラート判定**: SPI 閾値 (<0.8 critical, <0.9 warning) で alerts 配列を生成

### ワークベンチ UI
- **トップバー**: ブランド + EVM STUDIO ロゴ + プロジェクトピッカー（SPI付き）+ 基準日ピッカー（カレンダー入力・プリセット） + 通知ベル + アバター
- **左レール（232px固定）**: Projects セクション（SPI / 警告件数バッジ） + Members セクション（クリックで Inspector を Member モードに切替）
- **中央**:
  - **サマリストリップ**: プロジェクト名 / 残日数 / 進捗% / SPI / CPI / BAC / EV / AC / VAC（前日比トグル付き）
  - **アラートストリップ**: 警告/重要アラート列 or "HEALTHY" バナー
  - **ガント**: WBS 階層・進捗バー・基準日縦線・雷線（実績進捗ライン）。「全画面で見る」ボタンで GanttFullscreen を開く
  - **チャート行**: SPI/CPI トレンド + CCPM フィーバーチャート（それぞれ全画面ボタン付き）
- **右 Inspector（380px固定）**: Task / Member / Team の3タブ
  - **Task モード**: 選択タスクの code / name / Progress / SPI&CPI&EV&PV&AC&BAC / SPI スパークライン / Assignee カード
  - **Member モード**: 担当者の集計 SPI/CPI/EV/PV/BAC/AC + SPI スパークライン + 担当タスク一覧
  - **Team モード**: 全担当者の SPI / CPI / EV を一覧（前日比表示対応）

### 全画面モーダル
- **GanttFullscreen**: ESC で閉じる。タスク検索 / 担当者セレクト（未完件数付き）/ 状態フィルター（すべて / 遅延 / 完了以外 / 未着手 / 進行中 / 完了）+ WBS情報列（工数 / 予定期間 / 実績期間 / 進捗）。行クリックで進捗入力サブパネルを右にスライド表示
- **ChartFullscreen**: SPI Trend または Fever Chart を画面いっぱいに拡大

### レポート出力（将来）
- 朝報スタイルの EVM サマリーをエクスポート（フェーズ2）

## Target Use Cases

- プロジェクトマネージャーが基準日を毎営業日変えながら **前日比** で遅延の兆候を即時検知する
- リーダーが Inspector の Member タブで担当者ごとの SPI/CPI 推移を確認し、リスクのある担当者へドリルダウンする
- 担当者がガント全画面 → 該当タスククリック → 進捗入力サブパネルで日次進捗を10秒以内に記録する
- 複数プロジェクトの SPI/警告件数を左レールで横断比較する

## Value Proposition

Excel + VBA の EVM 管理ツールをサーバーレス Web アプリに置き換える。クラウドインフラ不要で `npm start` だけで起動でき、インターネット環境がない現場でも動作する。**画面遷移なしの単一ワークベンチ** + **モーダル進捗入力** により、PM の毎日の状況確認・進捗反映を1画面で完結させる。

## Design Tokens（mockup 由来）

- **ブランド色**: 黄緑 `#9bc132` / 濃緑 `#7ea61f`（Prime Brains ブランド）
- **ペーパー色**: `#f7f4ec`（warm paper）/ `#fbf9f2`（paperWarm）
- **ステータス色**: 緑 `#5d8a3a` / 黄 `#c89a2d` / 赤 `#b8482e` / 灰 `#9a958a`
- **フォント**: 本文 `Inter`、ブランド `Cinzel`、数値 `JetBrains Mono`、見出し `Source Serif 4`
- **モチーフ**: warm paper（温かみのある紙）+ 製図風アクセント（実装時に Tailwind トークンへ落とし込む）
