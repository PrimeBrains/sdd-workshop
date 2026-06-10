# fixture-normal 設計

## Overview

正常系フィクスチャの設計文書。全 AC を新表記（個別全列挙）でカバーする。

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1, 1.2 | 検索 | SearchService | search() | 検索フロー |
| 2.1, 2.2 | 表示 | ArticleView | render() | 表示フロー |

## Components

### SearchService

| Field | Detail |
|-------|--------|
| Intent | キーワード検索 |
| Requirements | 1.1, 1.2 |
