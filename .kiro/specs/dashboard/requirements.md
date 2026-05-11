# 要件定義書: dashboard

## Introduction

EVM Studio のダッシュボード機能は、プロジェクト管理者・担当者が EVM メトリクスを一画面で視覚的に把握できる可視化レイヤーである。
evm-engine が算出した SPI/CPI・CCPM バッファ・担当者別進捗を時系列チャート・フィーバーチャート・サマリーテーブル・アラートバナーとして表示する。
基準日とプロジェクトを選択するだけでリアルタイムに近い形でメトリクスが更新され、遅延タスクをアラートで見落とさないようにする。

## Boundary Context

- **In scope**: SPI/CPI トレンドチャート表示、CCPM フィーバーチャート表示、担当者別 EVM テーブル表示、プロジェクトサマリー表示、アラートバナー表示、プロジェクト選択、基準日選択、`evm.calculate` tRPC エンドポイント、TanStack Query キャッシュ管理
- **Out of scope**: EVM メトリクスの計算ロジック（evm-engine が担う）、進捗データの永続化・入力（progress-tracking が担う）、朝報レポート生成（reporting が担う）、認証・認可
- **Adjacent expectations**: evm-engine の `calculateEvmMetrics` / `calculateFeverChart` / `findCriticalPath` を呼び出してデータを集約する。progress-tracking の `progress.getLatest` で最新スナップショットを取得する。

## Requirements

### Requirement 1: プロジェクト・基準日の選択

**Objective:** プロジェクト管理者として、表示対象のプロジェクトと基準日を選択したい。そうすることで、任意の時点の EVM メトリクスを確認できる。

#### Acceptance Criteria

1. When ダッシュボードページが表示される, the Dashboard shall プロジェクト一覧をドロップダウンとして表示する
2. When ユーザーがプロジェクトを選択する, the Dashboard shall 選択されたプロジェクトの EVM データを読み込む
3. The Dashboard shall 基準日ピッカーを表示し、デフォルト値を今日の日付に設定する
4. When ユーザーが基準日を変更する, the Dashboard shall 新しい基準日で EVM データを再取得する
5. While データ取得中である, the Dashboard shall ローディングインジケータを表示する
6. If データ取得に失敗した場合, the Dashboard shall エラーメッセージを表示する

---

### Requirement 2: アラートバナー

**Objective:** プロジェクト管理者として、SPI が閾値を下回るタスクをページ上部のバナーで即座に確認したい。そうすることで、遅延タスクの見落としを防げる。

#### Acceptance Criteria

1. When SPI < 0.8 のタスクが存在する場合, the Dashboard shall 赤色（critical）のアラートバナーをページ上部に表示する
2. When 0.8 ≤ SPI < 0.9 のタスクが存在する場合, the Dashboard shall 黄色（warning）のアラートバナーをページ上部に表示する
3. The Dashboard shall アラートバナーにタスク名・担当者名・SPI 値を一覧表示する
4. When SPI ≥ 0.9 かつ critical/warning アラートが存在しない場合, the Dashboard shall アラートバナーを表示しない
5. Where PV = 0 のタスクは SPI が算出不能であるため, the Dashboard shall アラート評価から除外しグレー（N/A）として扱う

---

### Requirement 3: プロジェクトサマリー

**Objective:** プロジェクト管理者として、プロジェクト全体の EVM 指標（BAC/EAC/VAC/ETC/TCPI/SPI/CPI）を数値で確認したい。そうすることで、プロジェクト全体の健全性を把握できる。

#### Acceptance Criteria

1. The Dashboard shall BAC・EAC・VAC・ETC・TCPI・全体 SPI・全体 CPI を数値カードとして表示する
2. When 全体 SPI < 0.8 の場合, the Dashboard shall SPI カードを赤色で強調表示する
3. When 0.8 ≤ 全体 SPI < 0.9 の場合, the Dashboard shall SPI カードを黄色で強調表示する
4. When 全体 SPI ≥ 0.9 の場合, the Dashboard shall SPI カードを緑色で表示する
5. If PV = 0 で SPI が算出不能の場合, the Dashboard shall SPI/CPI の値を "N/A" と表示する

---

### Requirement 4: SPI/CPI トレンドチャート

**Objective:** プロジェクト管理者として、SPI と CPI の時系列推移を折れ線グラフで確認したい。そうすることで、効率の改善・悪化トレンドを視覚的に把握できる。

#### Acceptance Criteria

1. The Dashboard shall 横軸を snapshot_date（日付）・縦軸を SPI/CPI 値とする折れ線チャートを表示する
2. The Dashboard shall SPI と CPI をそれぞれ別色の折れ線で重ねて表示する
3. The Dashboard shall チャート上に SPI=1.0 を示す基準線を表示する
4. When SPI または CPI が null の時点（PV=0）がある場合, the Dashboard shall その時点をチャートから除外する
5. The Dashboard shall 各データポイントにホバーした際にスナップショット日・SPI・CPI の値をツールチップで表示する

---

### Requirement 5: CCPM フィーバーチャート

**Objective:** プロジェクト管理者として、クリティカルチェーンのバッファ消費状況を CCPM フィーバーチャートで確認したい。そうすることで、プロジェクトの危険度を直感的に把握できる。

#### Acceptance Criteria

1. The Dashboard shall 横軸をクリティカルチェーン完了率（0〜1）・縦軸をバッファ消費率（0〜1）とする散布図を表示する
2. The Dashboard shall Green/Yellow/Red の 3 ゾーンを背景色として図示する（Green: 消費率 < 完了率 × 0.67、Yellow: 完了率 × 0.67 ≤ 消費率 < 完了率 × 1.0、Red: 消費率 ≥ 完了率 × 1.0）
3. The Dashboard shall 現在のプロジェクト状態を示すデータポイント（プロット）を表示する
4. The Dashboard shall データポイントのゾーンに応じた色（Green/Yellow/Red）でプロットを着色する
5. If バッファタスクが存在しない場合, the Dashboard shall フィーバーチャートを "バッファデータなし" として非表示または無効化する

---

### Requirement 6: 担当者別 EVM テーブル

**Objective:** プロジェクト管理者として、各担当者の BAC・EV・PV・SPI・AC・CPI と状態を一覧テーブルで確認したい。そうすることで、誰がどれだけ遅延しているかを把握できる。

#### Acceptance Criteria

1. The Dashboard shall 担当者ごとに BAC・EV・PV・SPI・AC・CPI・ステータスの列を持つテーブルを表示する
2. When 担当者の SPI < 0.8 の場合, the Dashboard shall そのテーブル行を赤色でハイライトする
3. When 0.8 ≤ 担当者の SPI < 0.9 の場合, the Dashboard shall そのテーブル行を黄色でハイライトする
4. When 担当者の SPI ≥ 0.9 の場合, the Dashboard shall そのテーブル行を緑色で表示する
5. If 担当者の PV = 0 で SPI が算出不能の場合, the Dashboard shall SPI/CPI を "N/A" と表示しステータスを "N/A" にする

---

### Requirement 7: データキャッシュとパフォーマンス

**Objective:** プロジェクト管理者として、ダッシュボードデータが適切にキャッシュされ、不要な再取得を避けたい。そうすることで、快適に操作できる。

#### Acceptance Criteria

1. The Dashboard shall TanStack Query を使用して EVM データをキャッシュし、staleTime を 5 分に設定する
2. When ユーザーが同一のプロジェクト・基準日に戻った場合（5 分以内）, the Dashboard shall キャッシュからデータを返しサーバーへの再リクエストを行わない
3. The Dashboard shall tRPC `evm.calculate` エンドポイントを呼び出してデータを取得する（入力: projectId と baseDate）

---

### Requirement 8: tRPC エンドポイント（evm.calculate）

**Objective:** フロントエンドとして、プロジェクト ID と基準日を渡すだけで全 EVM データを一括取得したい。そうすることで、複数エンドポイントへの並列リクエストを避けられる。

#### Acceptance Criteria

1. The Dashboard shall `evm.calculate` tRPC クエリプロシージャを実装し、`{ projectId: number, baseDate: string }` を入力とする
2. The Dashboard shall `evm.calculate` のレスポンスとして `{ summary, tasks[], assignees[], alerts[], feverChart, spiTrend[] }` を返す
3. If projectId が存在しない場合, the Dashboard shall `PROJ_NOT_FOUND` エラーを返す
4. If baseDate のフォーマットが不正の場合, the Dashboard shall バリデーションエラーを返す
5. The Dashboard shall `evm.calculate` のサーバー実装で evm-engine の純粋関数を呼び出し、DB から最新スナップショットを取得して計算を実行する

---

### Requirement 9: レスポンシブレイアウト

**Objective:** プロジェクト管理者として、ダッシュボードがモバイル〜デスクトップの画面サイズで適切に表示されたい。そうすることで、様々なデバイスから確認できる。

#### Acceptance Criteria

1. The Dashboard shall TailwindCSS 4 を使用してレスポンシブレイアウトを実装する
2. The Dashboard shall デスクトップ（lg:）ではグリッドレイアウト（2 カラム以上）でコンテンツを配置する
3. The Dashboard shall モバイル（sm:）では 1 カラムのスタック表示に切り替える
