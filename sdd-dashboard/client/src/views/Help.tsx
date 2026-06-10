const STAGES = [
  { name: 'Discovery', desc: 'アイデア出し・境界探索', cmd: '/kiro-discovery', out: 'brief.md, roadmap.md' },
  { name: 'Requirements', desc: 'EARS 形式の要件定義', cmd: '/kiro-spec-requirements', out: 'requirements.md' },
  { name: 'Design', desc: 'アーキテクチャ設計', cmd: '/kiro-spec-design', out: 'design.md, research.md' },
  { name: 'Tasks', desc: '実装タスク分解', cmd: '/kiro-spec-tasks', out: 'tasks.md' },
  { name: 'Implementation', desc: 'TDD 実装 + レビュー', cmd: '/kiro-impl', out: 'コード + テスト' },
]

export function Help() {
  return (
    <div>
      <h1 className="page-title">cc-sdd（Kiro スペック駆動開発）とは</h1>
      <div className="page-sub">初見の開発者向け: このプロジェクトの開発フロー解説</div>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          cc-sdd は「<b>要件 → 設計 → タスク → 実装</b>」を文書として確定させながら進める開発手法です。
          各フェーズの成果物は <code>.kiro/specs/&lt;feature&gt;/</code> に markdown で保存され、
          <b>フェーズ間には人間の承認ゲート</b>があります。AI が生成し、人間がレビューして承認することで次へ進みます。
        </p>
        <div className="flow">
          {STAGES.map((s, i) => (
            <span key={s.name} style={{ display: 'contents' }}>
              {i > 0 && <span className="gate">▶<br />{i < 4 ? '承認' : '承認'}</span>}
              <div className="stage">
                <b>{s.name}</b>
                <small>{s.desc}</small>
                <span className="cmd">{s.cmd}</span>
                <small>{s.out}</small>
              </div>
            </span>
          ))}
        </div>
        <p className="note">
          手戻り: 実装中に要件変更が起きたら、該当フェーズへ巻き戻して下流の承認を取り消し、再生成 → 再承認します（ボード画面の「手戻り」ボタン）。
        </p>
      </div>

      <h2 style={{ fontSize: 15, marginTop: 26 }}>レビューの観点</h2>
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ flex: 1 }}>
          <b>Requirements 承認時</b>
          <ul style={{ fontSize: 12.5, paddingLeft: 18, marginBottom: 0 }}>
            <li>EARS 文（英文 + 和訳）が検証可能か</li>
            <li>スコープ外（Out of Boundary）が明確か</li>
          </ul>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <b>Design 承認時</b>
          <ul style={{ fontSize: 12.5, paddingLeft: 18, marginBottom: 0 }}>
            <li>トレーサビリティ: 全要件が設計でカバーされているか（マトリクス画面）</li>
            <li>境界とコントラクトが下流スペックと整合するか</li>
          </ul>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <b>Tasks 承認時</b>
          <ul style={{ fontSize: 12.5, paddingLeft: 18, marginBottom: 0 }}>
            <li>各タスクが 1-3 時間サイズで検証可能な成果物を持つか</li>
            <li>全 AC がいずれかのタスクに紐づくか</li>
          </ul>
        </div>
      </div>

      <h2 style={{ fontSize: 15, marginTop: 26 }}>主要な規約（ステアリング）</h2>
      <ul style={{ fontSize: 13 }}>
        <li><code>trace-notation.md</code> — 要件 ID 参照は全列挙（範囲表記禁止）。このダッシュボードのリンクはこの規約の上に成立しています</li>
        <li><code>requirements-style.md</code> — EARS 英文 + 和訳の二言語併記</li>
        <li><code>adr.md</code> — 複数スペックに影響する決定は ADR に記録</li>
      </ul>
    </div>
  )
}
