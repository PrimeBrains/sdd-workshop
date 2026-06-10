# Requirements Document

## Introduction

正常系フィクスチャ（新表記・完全整合）。

## Requirements

### Requirement 1: 検索機能

**Objective:** 利用者として、語句で記事を検索したい。目的の記事へ素早く到達するため。

#### Acceptance Criteria

1. When a user submits a keyword, the system shall return matching articles.
   - 和訳: 利用者がキーワードを送信したとき、システムは一致する記事を返す。
2. If no article matches, the system shall return an empty list.
   - 和訳: 一致する記事がない場合、システムは空のリストを返す。

### Requirement 2: 記事表示

**Objective:** 利用者として、記事本文を読みたい。検索結果から内容を確認するため。

#### Acceptance Criteria

1. When a user opens an article, the system shall render its body.
   - 和訳: 利用者が記事を開いたとき、システムは本文を描画する。
2. The system shall show the last updated date of the article.
   - 和訳: システムは記事の最終更新日を表示する。
