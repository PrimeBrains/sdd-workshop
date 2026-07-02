---
name: commit-push
description: 変更をコミットして GitHub（PrimeBrains/sdd-workshop）へプッシュする。git status/diff で内容確認→Conventional Commits 形式の日本語メッセージ作成→add→commit→push。引数にコミットメッセージや関連 issue 番号(#N)を取れる（例 /commit-push #1 初期化スキャフォールド一式）。
allowed-tools: Bash, Read
argument-hint: "[コミットメッセージ] [#N]"
metadata:
  origin: "custom"
---

# commit-push — コミット＆プッシュ

変更をコミットし、GitHub（`PrimeBrains/sdd-workshop`）へプッシュする。
**push はネットワークに出る操作なので、必ず内容を確認してから実行する。**
push 認証は **HTTPS ＋ gh 資格情報（アカウント `pbnakao`）**（詳細は手順 5）。

## 共通ブートストラップ（必ず最初に実行）

対話プロンプトによるハングを防ぐため `GIT_TERMINAL_PROMPT=0` を設定する。
bash のシェル状態は Bash ツール呼び出し間で揮発するため、必要なら各コマンドの
先頭で再設定する。

```bash
export GIT_TERMINAL_PROMPT=0
```

## 手順

引数: コミットメッセージ（任意）／関連 `#N`（任意）。作業ディレクトリは対象リポ直下。

1. **変更内容を確認**（コミット前に必ず提示）
   ```bash
   git status
   git diff --stat
   git branch --show-current
   ```
   - 機密（トークン・パスワード・鍵）が diff に混入していないかチェックする。あれば中断。
   - **セッション外変更の切り分け（混入防止）**: `git status` の全エントリを
     「**このセッションで自分が変更・生成したもの**」と「**出所不明（他セッション・他プロセス由来の
     可能性があるもの）**」に分類する。同じ作業ツリーを複数セッションが共有していることがあるため、
     見覚えのない変更は他セッションの作業中ファイルかもしれない。出所不明の変更は**既定でステージに
     含めない**（判断に迷う場合のみユーザーに含否を確認する）。
   - 現在ブランチを把握する。このリポは **main 中心運用**（通常 main へ直 commit/push）。

2. **コミットメッセージを決める**
   - 引数で渡されていればそれを使う。
   - 無ければ変更内容から Conventional Commits 形式（`feat(...)` / `fix(...)` /
     `docs(...)` / `chore(...)` 等、**日本語の件名**）で簡潔なメッセージを起こし、
     ユーザーに確認を取る。
   - 関連 issue があれば本文に `#N` を含める。

3. **ステージ（既定はパス限定 — `git add -A` を既定にしない）**
   ```bash
   git add <path1> <path2> ...   # 既定: 今回の作業に属するパスを明示
   # git add -A                  # 全変更が今回の作業だと 1. で確認できた場合のみ
   ```
   - 手順 1 で「出所不明」に分類した変更はステージしない。触らず（削除・復元もせず）残し、
     手順 6 の報告で「未コミットで残した変更」として列挙する。

4. **コミット**（複数行は heredoc。末尾に実行中モデルの Co-Authored-By トレーラを付与 —
   ハーネス指示に従う。例は現行モデル）
   ```bash
   git commit -m "$(cat <<'EOF'
   <件名>

   <本文 / #N>

   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   EOF
   )"
   ```

5. **プッシュ（HTTPS ＋ gh 資格情報 = `pbnakao`）**
   - この repo は `origin` = `https://github.com/PrimeBrains/sdd-workshop.git`、
     repo-local の `credential.helper` が `!gh auth git-credential` に配線済み
     （push は **gh のアクティブアカウント**のトークンで行われる）。
   - push 前に gh のアクティブアカウントが **pbnakao** であることを確認:
     ```bash
     gh auth status                                # pbnakao が Active か
     gh auth switch --hostname github.com --user pbnakao   # 違うときだけ
     git push                     # 上流設定済みの場合
     git push -u origin HEAD      # 上流未設定の場合
     ```

6. **報告**: 成功したら `git status` で確認し、ユーザーに結果（ブランチ・コミット ID・
   **ステージから除外して残した変更があればその一覧**）を報告する。

## push が拒否されたとき

| 症状 | 対応 |
|---|---|
| `403` / `Permission ... denied to nakawodayo` | 資格情報が nakawodayo になっている。**nakawodayo は read のみで push 不可**。`gh auth switch --user pbnakao` → 再 push |
| `refusing to allow an OAuth App to ... workflow ... without 'workflow' scope` | `.github/workflows/**` を含むコミット。gh トークンに workflow スコープが必要。対話認証のためユーザーに `! gh auth refresh -h github.com -s workflow` の実行を依頼 → 再 push |
| SSH（`git@github.com:...`）へ切り替えたくなったら | **やらない**。SSH 鍵（`~/.ssh/id_ed25519`）は nakawodayo 紐づけで push 権限が無い |
| 保護ブランチ等それ以外の拒否 | ユーザーへ報告し、対応を仰ぐ |

## 注意・ハマりどころ

- push は外部に出る操作。**必ず内容確認後に実行**し、ユーザー承認を取る。
- 認証は **HTTPS ＋ gh（pbnakao）**。SSH・トークン URL・対話プロンプトに頼らない
  （GCM に残る nakawodayo の PAT は push 権限が無い）。
- 機密（トークン・パスワード・鍵）を diff に混入させない／コミットしない。あれば中断。
- **他セッションの作業を巻き込まない**: 出所不明の変更は既定で除外（手順 1・3）。
  `git add -A` は全変更の出所を確認できたときだけ。
- main 中心運用。push が拒否された場合は上の表 → 解決しなければユーザーへ報告。
