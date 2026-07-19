---
status: working-ledger
issue: 39
---

# #39 受け入れテスト結果レポート（falsifiable・2026-07-20）

規模はユーザー裁定（2026-07-19）どおり: **ドライラン主体＋実走 1 本＋陰性対照は実差分で実証**。

## 総合判定: **PASS**（A: 8/8 経路一致・B: フル実走で全ゲート実 PASS・C: 陰性対照 2 種とも検知）

---

## A. ルーティング・ドライラン（7 クラス代表＋triage 陰性）

方式: 期待値を知らない独立判定 worker（sonnet）に steering §2/§3/§4 と moira-change SKILL の
規則のみを与え、8 件の代表 issue 文を P1 triage〜P3 経路確定まで判定させ、著者の期待表と突合
（著者≠判定者）。

| # | 代表 issue（要旨） | 期待 | 判定結果 | 一致 |
|---|---|---|---|---|
| T1 | EV_abs 算入規則の変更（MODEL 導出規則） | M → moira-model-update | M・平易文批准・P3 再裁定ループまで正しく導出 | ✓ |
| T2 | 表示だけに見えて意味論に触れるかもしれない | D 既定ルート → catalog proposed → doc-refine → 仕分け弁 | D（§3 境界規則の文言に接地）・昇格ループ・仕分け (a) まで導出 | ✓ |
| T3 | 不変条件の新設＋機械検証 | P（①一文＋②PBT） | P・①→② の intra-P 順序まで導出 | ✓ |
| T4 | 既存 unit の When/Then 変更（issue に人間記述あり） | S(unit) → kiro-scenario（issue 記載を発案扱い） | S・「HA では聞かない」の裏返しまで正確・agreed 後 e2e | ✓ |
| T5 | 表示フォーマットのみの変更 | C 級 | C 級判定は一致。**triage は worker=軽量／著者期待=フル工程で相違**（下記観察） | ✓（クラス・経路）／△（triage） |
| T6 | coverage-check.test.ts の改修 | V → 自己検証禁止プロトコル | V（§3 にファイル名列挙）・人間タッチポイントなしまで正確 | ✓ |
| T7 | steering への節追記 | F → doc-refine | F・HA 対象外（文書ゲート内批准）まで正確 | ✓ |
| T8 | 誤字 1 文字（triage 陰性対照） | 軽量・フロー不起動 | 軽量・台帳も作らない、まで正確 | ✓ |

**観察（T5・欠陥ではなく規範の裁量域）**: triage のフル／軽量分岐は規範が意図的にアルゴリズム化して
いない（plan §8-3 裁定・kiro-discovery action-path 同型）。純 C 級で境界疑義のない issue を worker は
「軽量」に倒した（誤判定バックストップ＝既存検知器への依拠を明示した正直な留保つき）。クラス判定・
経路はいずれの読みでも一致しており、受け入れ基準（正しい経路）は満たす。運用データが集まったら
triage 目安の追記を検討してよい（本レポートでは追跡 issue を起こさない——現状は設計どおり）。

## B. フル実走 1 本（issue #43・F 級・P1→P6）

実 issue [#43](https://github.com/PrimeBrains/sdd-workshop/issues/43)（moira/README.md へ変更管理フロー
入口案内を追記）を moira-change で実走。証跡は `moira/changes/issue-43/`（request / impact-map /
intent-ratification / closure-report）と issue コメント。

| 工程 | 実施内容 | 判定 |
|---|---|---|
| P1 | 会話依頼→起票（入口 (c)）・要求文明確化・F 級仮判定・triage フル・base=0f90cab 記録・issue に理由一言 | ✓ |
| P2 | トレース機構逆引き（DECISIONS-CATALOG grep・PROPERTIES・SPEC_META・coverage-check）→ ヒットなし＝単一 F 行。人間断面 3 節（3面なし・F バケット・コード節なし） | ✓ |
| P3/HA | 提示規約どおり（詳細 md → コンソールサマリ → AskUserQuestion は最終裁定 1 回のみ）。マップ確認・実行計画＋一次資料承認をユーザーが批准・issue コメントに要約 | ✓ |
| P4 | doc-refine ゲート実走（doc-adversary 1＋codex 1 → 著者パッチ → doc-gate-judge）。**実 PASS**——codex Important 2 は修正で決着・Claude 敵対者 Critical/Important 0・**意図整合検査 ALIGNED・fork 被覆監査 OK**（事前批准記録の受け入れ契約が実際に機能——ループ内 AskUserQuestion ゼロ） | ✓ |
| P5 | base..HEAD・`moira/changes/` 自己除外で changed − mapped = ∅・R1 は gate verdict を証跡に resolved・deferred なし → 閉包 PASS | ✓ |
| P6/H5 | 閉包レポート先頭 3 点のみで薄い承認 → クローズ（本レポート確定時点で実施） | ✓ |

## C. 陰性対照（実差分・必須）

| # | 内容 | 結果 |
|---|---|---|
| C-1 | **わざと同期を 1 箇所落とす**: 影響マップに載せていない moira/NAMING.md へ 1 行を混入しコミット（cc2ece7）→ P5 の未マップ差分検査を実行 | **検知成功**——`changed − mapped = {moira/NAMING.md}` ≠ ∅ → 閉包 FAIL を正しく出力。revert（7d859ae）後の再検査で ∅ に復帰（base..HEAD 端点差分から消えることも確認） |
| C-2 | **コミット存在だけで resolved にできないこと**: R1 はコミット 0d77261 の存在時点では未了のまま。doc-gate-judge の PASS verdict（検証器証跡）が付いて初めて resolved に遷移 | **規則どおり適用**（closure-report.md 機械決着詳細に記録） |

## 正直枠

- 本テストは P5 の検出力のうち「未マップ差分」「証跡なし resolved 拒否」を実証した。P2 調査自体の
  網羅性・意味的波及の見落とし（steering §5「P5 の限界」）は本テストの検証対象外——設計どおり
  未整備義務として残る。
- M/D/P/S/V 級のフル実走（各ゲートの実 PASS）は未実施（ユーザー裁定の規模＝ドライラン主体。#41 以降の
  実戦 issue が実走の場になる）。
- 構築フェーズ自体の確定ゲート記録は `gate-round-records.md`（Loop A/B とも PASS・3R）。
