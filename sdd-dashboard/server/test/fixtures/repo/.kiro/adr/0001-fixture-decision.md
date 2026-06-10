---
id: 1
title: フィクスチャ構成を採用する
status: accepted
date: "2026-06-04"
app: null
specs: [fixture-normal]
requirements: ["fixture-normal/1.1"]
supersedes: "0000"
superseded_by: null
---

# ADR-0001: フィクスチャ構成を採用する

## Context

統合テスト用に手で監査可能な固定フィクスチャが必要になった。

## Decision

`test/fixtures/repo` 配下に最小の `.kiro` ツリーを置き、期待値を手計算で導出する。

## Consequences

- 正: 診断件数・展開結果を厳密値でアサートできる
- 負: フィクスチャ変更時はテスト期待値の更新が必要
