# Requirements Document

### Requirement 1: データ取込

**Objective:** 運用者として、外部データを取り込みたい。手作業を減らすため。

#### Acceptance Criteria

1. When a file is dropped, the system shall import it.
2. If the file is invalid, the system shall reject it.
3. The system shall log every import.

### Requirement 2: 通知

**Objective:** 運用者として、取込完了を知りたい。次の作業へ進むため。

#### Acceptance Criteria

1. When an import completes, the system shall notify the operator.
2. If notification fails, the system shall retry once.
