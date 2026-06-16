---
name: commit-push
description: 変更をコミットして GitHub（PrimeBrains/sdd-workshop）へプッシュする。git status/diff で内容確認→Conventional Commits 形式の日本語メッセージ作成→add→commit→push。引数にコミットメッセージや関連 issue 番号(#N)を取れる（例 /commit-push #1 初期化スキャフォールド一式）。
allowed-tools: Bash, Read
argument-hint: "[コミットメッセージ] [#N]"
metadata:
  origin: "custom"
---

# commit-push — コミット＆プッシュ

変更をコミットし、GitHub（`PrimeBrains/sdd-workshop`・SSH push）へプッシュする。
**push はネットワークに出る操作なので、必ず内容を確認してから実行する。**

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
   - 現在ブランチを把握する。このリポは **main 中心運用**（通常 main へ直 commit/push）。

2. **コミットメッセージを決める**
   - 引数で渡されていればそれを使う。
   - 無ければ変更内容から Conventional Commits 形式（`feat(...)` / `fix(...)` /
     `docs(...)` / `chore(...)` 等、**日本語の件名**）で簡潔なメッセージを起こし、
     ユーザーに確認を取る。
   - 関連 issue があれば本文に `#N` を含める。

3. **ステージ**（範囲をユーザーに確認）
   ```bash
   git add -A        # または対象パスを限定
   ```

4. **コミット**（複数行は heredoc。末尾に Co-Authored-By トレーラを付与）
   ```bash
   git commit -m "$(cat <<'EOF'
   <件名>

   <本文 / #N>

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   EOF
   )"
   ```

5. **プッシュ**（SSH リモート設定済みのため明示認証は不要）
   ```bash
   git push                     # 上流設定済みの場合
   git push -u origin HEAD      # 上流未設定の場合
   ```
   - 成功したら `git status` で確認し、ユーザーに結果（ブランチ・コミット ID）を報告する。

## 注意・ハマりどころ

- push は外部に出る操作。**必ず内容確認後に実行**し、ユーザー承認を取る。
- 認証は SSH（`git@github.com:PrimeBrains/sdd-workshop.git`）。トークン URL・資格情報
  マネージャ・対話プロンプトに頼らない。`gh` には依存しない（未インストール想定）。
- 機密（トークン・パスワード・鍵）を diff に混入させない／コミットしない。あれば中断。
- main 中心運用。push が保護ブランチ等で拒否された場合はユーザーへ報告し、対応を仰ぐ。
