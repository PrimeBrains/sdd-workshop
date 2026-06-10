/**
 * AuditLog — 書込監査ログ（Requirement 12.3）。
 * 全書込試行（拒否・途中失敗を含む）を構造化 JSON 1 行としてサーバーログへ出力する。
 * `.kiro/` 内には書かない（成果物を汚染しない。design.md SafePathGuard + AuditLog ブロック）。
 * sink は注入可能（テスト用）で、デフォルトは stderr（サーバーログ）。
 */

/** 書込 API の操作種別（design.md AuditEntry 契約と 1:1） */
export type AuditOperation = "approval-update" | "rollback" | "adr-create";

/** 試行の結果: 成功 / ガード・バリデーション拒否 / 途中失敗 */
export type AuditOutcome = "success" | "rejected" | "failed";

/** 監査ログ 1 行分のエントリ（12.3: タイムスタンプ・操作種別・対象パス・結果） */
export interface AuditEntry {
  /** ISO 8601 タイムスタンプ */
  readonly at: string;
  readonly operation: AuditOperation;
  readonly targetPath: string;
  readonly outcome: AuditOutcome;
  /** 拒否・失敗時の ErrorCode（成功時は null） */
  readonly errorCode: string | null;
}

/** JSON 1 行（改行なし）を受け取る出力先 */
export type AuditSink = (line: string) => void;

export interface AuditLog {
  /** 書込試行 1 件を記録し、出力したエントリを返す */
  record(input: {
    operation: AuditOperation;
    targetPath: string;
    outcome: AuditOutcome;
    errorCode?: string | null;
  }): AuditEntry;
}

const stderrSink: AuditSink = (line) => {
  process.stderr.write(`${line}\n`);
};

export function createAuditLog(
  options: { sink?: AuditSink; now?: () => Date } = {},
): AuditLog {
  const sink = options.sink ?? stderrSink;
  const now = options.now ?? (() => new Date());
  return {
    record(input) {
      const entry: AuditEntry = {
        at: now().toISOString(),
        operation: input.operation,
        targetPath: input.targetPath,
        outcome: input.outcome,
        errorCode: input.errorCode ?? null,
      };
      sink(JSON.stringify(entry));
      return entry;
    },
  };
}
