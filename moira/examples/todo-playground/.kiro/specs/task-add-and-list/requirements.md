# Requirements Document

## Introduction

本フィーチャーは、ごくシンプルな TODO アプリの最初の縦スライスとして、**タスクの追加**と**追加したタスクの
一覧表示**、および**再読み込み後もタスクが保持される永続化**を提供する。対象は単一ユーザーのローカル利用で、
ユーザーは頭の中の「やること」をタイトルとして書き留め、残っているタスクを一覧で把握できるようになる。
完了/取消・削除・期限などは本フィーチャーの範囲外（後続スペック）とし、スコープを小さく保つ。

## Boundary Context

- **In scope**: タスクの追加（タイトル）、タスクの一覧表示（追加順）、再読み込み後も内容が保持される永続化、空状態の表示、空タイトルの拒否。
- **Out of scope**: タスクの完了/取消、削除、期限、並べ替え・フィルタ、検索、複数ユーザー・共有・同期、サーバー保存、認証。
- **Adjacent expectations**: 完了・削除・期限は本フィーチャーでは提供せず、後続フィーチャーが担う。ユーザーには「まず追加と一覧ができる」ことのみを約束する。

> 記述スタイル: Acceptance Criteria は steering `requirements-style.md` に従い、英文 EARS 1 行 + `- 和訳:` 1 行のペアで書く。散文（Introduction / Objective / Boundary Context）は日本語のみ。

## Requirements

### Requirement 1: タスクの追加

**Objective:** 単一ユーザーとして、タイトルを入力してタスクを追加したい。頭の中のやることを書き留めて忘れずに済むからである。

#### Acceptance Criteria

1. When the user performs the add action with a title entered, the TODO app shall create a new task with that title.
   - 和訳: ユーザーがタイトルを入力して追加操作を行ったとき、TODO アプリは そのタイトルを持つタスクを新規に作成する。
2. When a new task is created, the TODO app shall add it to the list and display it.
   - 和訳: タスクが新規に作成されたとき、TODO アプリは そのタスクを一覧に追加して表示する。
3. When a task has been added, the TODO app shall clear the input field so that the next task can be entered.
   - 和訳: タスクの追加が完了したとき、TODO アプリは 入力欄を空にして次のタスクを入力できる状態にする。
4. If the title is empty or whitespace-only when the add action is performed, then the TODO app shall not create a task and shall indicate that a title is required.
   - 和訳: タイトルが空文字または空白のみの状態で追加操作が行われたならば、TODO アプリは タスクを作成せず、タイトルの入力が必要であることを示す。

### Requirement 2: タスクの一覧表示

**Objective:** 単一ユーザーとして、追加したタスクを一覧で見たい。いま残っているやることを把握できるからである。

#### Acceptance Criteria

1. The TODO app shall display the added tasks in the order they were added, from oldest to newest.
   - 和訳: TODO アプリは 追加済みのタスクを追加順（古いものから新しいものへ）に一覧表示する。
2. When the list is displayed, the TODO app shall show the title of each task.
   - 和訳: 一覧が表示されたとき、TODO アプリは 各タスクのタイトルを表示する。
3. While no task exists, the TODO app shall display an empty state indicating that there are no tasks.
   - 和訳: タスクが1件も存在しない間、TODO アプリは タスクが無いことを示す空状態を表示する。

### Requirement 3: 再読み込み後の永続化

**Objective:** 単一ユーザーとして、追加したタスクをブラウザを閉じたり再読み込みしても保持したい。次に開いたときも続きから使えるからである。

#### Acceptance Criteria

1. When a task is added, the TODO app shall save it so that it can be referenced in subsequent sessions.
   - 和訳: タスクが追加されたとき、TODO アプリは そのタスクを次回以降も参照できるよう保存する。
2. When the user reloads the page, the TODO app shall restore the previously saved tasks in their added order and display them in the list.
   - 和訳: ユーザーがページを再読み込みしたとき、TODO アプリは それまでに保存されたタスクを追加順で復元して一覧に表示する。
3. If no saved task exists when the app starts, then the TODO app shall start with an empty list.
   - 和訳: 保存されたタスクが存在しない状態でアプリが起動したならば、TODO アプリは 空の一覧で開始する。
4. If the saved task data is unreadable when the app starts, then the TODO app shall treat it as an empty list and continue to accept new task additions normally.
   - 和訳: 保存されたタスクの内容が読み取れない状態でアプリが起動したならば、TODO アプリは 空の一覧として扱い、以降のタスク追加を通常どおり受け付ける。
