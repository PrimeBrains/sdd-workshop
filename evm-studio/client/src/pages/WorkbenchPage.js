import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Task 3.2: WorkbenchPage
 * Requirements: 1.1-1.6, 12.1-12.5, 13.5-13.7, 18.1-18.5, 19.2
 *
 * 唯一のページ。11 個の状態スロットを集中管理し、`useEvm` で取得したデータを
 * 全子コンポーネントへ prop drilling する。子は presentational として実装されている。
 *
 * モックアップ `mockup/variation-a.jsx` の `VariationA()` 関数を 1:1 で TSX 化する形で構築。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useEvm } from '@/hooks/useEvm';
import { TopBar } from '@/components/shell/TopBar';
import { ProjectRail } from '@/components/shell/ProjectRail';
import { Inspector } from '@/components/shell/Inspector';
import { SummaryStrip } from '@/components/summary/SummaryStrip';
import { AlertStrip } from '@/components/alerts/AlertStrip';
import { GanttChart } from '@/components/gantt/GanttChart';
import { GanttFullscreen } from '@/components/gantt/GanttFullscreen';
import { SpiTrendChart } from '@/components/charts/SpiTrendChart';
import { FeverChart } from '@/components/charts/FeverChart';
import { ChartFullscreen } from '@/components/charts/ChartFullscreen';
import { Eyebrow } from '@/components/atoms/Eyebrow';
import { Pill } from '@/components/atoms/Pill';
import { Dot } from '@/components/atoms/Dot';
import { EVM } from '@/tokens/evm-tokens';
import { initialsOf, spiTone } from '@/lib/formatters';
// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
/**
 * モックアップ準拠の deriveTaskMetrics。
 * - `task.bac === 0` のときはすべてゼロを返す
 * - planned は `(baseDay - task.start) / duration` を [0,1] にクランプ
 * - cpi はモックアップの簡易スタブを踏襲（assignee 有 → 1.02、無 → 1.00）
 */
function deriveTaskMetrics(task, baseDay) {
    if (!task.bac)
        return { bac: 0, pv: 0, ev: 0, ac: 0, cpi: null };
    const duration = Math.max(1, task.end - task.start);
    const planned = Math.max(0, Math.min(1, (baseDay - task.start) / duration));
    const pv = task.bac * planned;
    const ev = task.bac * (task.progress / 100);
    const cpi = task.spi == null ? null : task.assignee ? 1.02 : 1.0;
    const ac = cpi ? ev / cpi : ev;
    return { bac: task.bac, pv, ev, ac, cpi };
}
/** タスク一覧から Inspector 初期選択の優先順位で 1 件取り出す */
function pickInitialTask(tasks) {
    if (tasks.length === 0)
        return null;
    return (tasks.find((t) => t.leaf && t.progress > 0 && t.progress < 100) ??
        tasks.find((t) => t.leaf) ??
        tasks[0]);
}
/** YYYY-MM-DD の日数差 (a - b) */
function diffDays(aISO, bISO) {
    const a = new Date(aISO + 'T00:00:00Z').getTime();
    const b = new Date(bISO + 'T00:00:00Z').getTime();
    return Math.round((a - b) / 86400000);
}
// ── Component ─────────────────────────────────────────────────────────────────
export default function WorkbenchPage() {
    // ── 11 個の状態スロット (要件 12.1) ─────────────────────────────────────
    const [projectId, setProjectId] = useState(1);
    const [baseDate, setBaseDate] = useState(todayISO);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [inspectorMode, setInspectorMode] = useState('task');
    const [inspectorMemberId, setInspectorMemberId] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [filter, setFilter] = useState('all');
    // ganttFull / chartFull は Phase 4 のモーダル用。本フェーズでは false 固定で更新可能な状態のみ用意。
    const [ganttFull, setGanttFull] = useState(false);
    const [chartFull, setChartFull] = useState(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    // ── データ取得 ───────────────────────────────────────────────────────────
    const projectsQuery = trpc.projects.list.useQuery();
    const membersQuery = trpc.members.listByProject.useQuery({ projectId: projectId ?? 0 }, { enabled: projectId !== null, staleTime: 5 * 60 * 1000 });
    const evmQuery = useEvm({ projectId, baseDate });
    const data = evmQuery.data;
    // ── 派生値 ───────────────────────────────────────────────────────────────
    const activeProjectRow = useMemo(() => projectsQuery.data?.find((p) => p.id === projectId) ?? null, [projectsQuery.data, projectId]);
    const activeProject = useMemo(() => {
        if (!activeProjectRow)
            return null;
        return {
            id: activeProjectRow.id,
            name: activeProjectRow.name,
            code: activeProjectRow.code ?? '',
            status: activeProjectRow.status,
            startDate: activeProjectRow.startDate,
            endDate: activeProjectRow.endDate,
        };
    }, [activeProjectRow]);
    // TopBar / ProjectRail 用に projects → 軽量プロジェクト構造へ写像する
    const topBarProjects = useMemo(() => {
        return (projectsQuery.data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code ?? '',
            status: p.status,
        }));
    }, [projectsQuery.data]);
    const railProjects = useMemo(() => {
        return (projectsQuery.data ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code ?? '',
            status: p.status,
            // 現在のプロジェクトのみ EVM データを反映、他はプレースホルダ
            spi: p.id === projectId && data ? data.summary.spi : null,
            taskCount: p.id === projectId && data ? data.tasks.length : 0,
            alertCount: p.id === projectId && data ? data.alerts.length : 0,
        }));
    }, [projectsQuery.data, projectId, data]);
    // MemberInfo は members API → UI 型へ写像 (role/initials が null の場合はフォールバック)
    const memberInfos = useMemo(() => {
        return (membersQuery.data ?? []).map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role ?? '',
            initials: m.initials ?? initialsOf(m.name),
        }));
    }, [membersQuery.data]);
    const assignees = data?.assignees ?? [];
    const tasks = data?.tasks ?? [];
    // baseDay は GanttMeta から取得 (デフォルト 0)
    const baseDay = data?.gantt.baseDay ?? 0;
    // 選択中タスクの解決 (Inspector / SummaryStrip の派生値用)
    const selectedTask = useMemo(() => {
        if (tasks.length === 0)
            return null;
        return (tasks.find((t) => t.id === selectedTaskId) ??
            tasks.find((t) => t.leaf) ??
            tasks[0] ??
            null);
    }, [tasks, selectedTaskId]);
    const taskMetrics = useMemo(() => {
        if (!selectedTask)
            return null;
        return deriveTaskMetrics(selectedTask, baseDay);
    }, [selectedTask, baseDay]);
    const taskTone = selectedTask ? spiTone(selectedTask.spi) : 'na';
    // compareMode 用の prevTaskMetrics
    const prevTaskMetrics = useMemo(() => {
        if (!compareMode || !selectedTask || !data?.prevDay)
            return null;
        const prevTask = data.prevDay.tasks.find((t) => t.id === selectedTask.id);
        if (!prevTask)
            return null;
        // prevTask は TaskPrevDiff (progress + spi) のため、deriveTaskMetrics に渡せる TaskEvm 形を構築
        const synthetic = {
            ...selectedTask,
            progress: prevTask.progress,
            spi: prevTask.spi,
        };
        return deriveTaskMetrics(synthetic, baseDay);
    }, [compareMode, selectedTask, data, baseDay]);
    // プロジェクト進捗率 / 残日数 (SummaryStrip のメタ表示)
    const projectProgress = useMemo(() => {
        if (!data || data.summary.bac === 0)
            return undefined;
        return Math.round((data.summary.ev / data.summary.bac) * 100);
    }, [data]);
    const remainingDays = useMemo(() => {
        if (!activeProject)
            return undefined;
        const d = diffDays(activeProject.endDate, baseDate);
        return d >= 0 ? d : 0;
    }, [activeProject, baseDate]);
    // ── 副作用: プロジェクト切替時 / データ更新時に selectedTaskId を初期化 ───
    useEffect(() => {
        if (!data)
            return;
        const exists = selectedTaskId != null && data.tasks.some((t) => t.id === selectedTaskId);
        if (exists)
            return;
        const picked = pickInitialTask(data.tasks);
        setSelectedTaskId(picked ? picked.id : null);
    }, [projectId, data, selectedTaskId]);
    // プロジェクト切替時に Inspector を Task モードへリセット
    useEffect(() => {
        setInspectorMode('task');
        setInspectorMemberId(null);
    }, [projectId]);
    // ── コールバック (useCallback でメモ化, 要件 19.2) ────────────────────────
    const handleProjectChange = useCallback((id) => {
        setProjectId(id);
        setProjectMenuOpen(false);
    }, []);
    const handleBaseDateChange = useCallback((iso) => {
        setBaseDate(iso);
    }, []);
    const handleToggleProjectMenu = useCallback(() => {
        setProjectMenuOpen((v) => !v);
        setDatePickerOpen(false);
    }, []);
    const handleToggleDatePicker = useCallback(() => {
        setDatePickerOpen((v) => !v);
        setProjectMenuOpen(false);
    }, []);
    const handleDismissPopovers = useCallback(() => {
        setDatePickerOpen(false);
        setProjectMenuOpen(false);
    }, []);
    const handleTaskClick = useCallback((task) => {
        setSelectedTaskId(task.id);
        setInspectorMode('task');
    }, []);
    const handleAlertJump = useCallback((alert) => {
        setSelectedTaskId(alert.taskId);
        setInspectorMode('task');
    }, []);
    const handleSwitchTask = useCallback(() => {
        setInspectorMode('task');
    }, []);
    const handleSwitchMember = useCallback((a) => {
        if (a)
            setInspectorMemberId(a.id);
        setInspectorMode('member');
    }, []);
    const handleSwitchTeam = useCallback(() => {
        setInspectorMode('team');
    }, []);
    const handleMemberSelect = useCallback((a) => {
        setInspectorMemberId(a.id);
        setInspectorMode('member');
    }, []);
    const handleCompareModeChange = useCallback((next) => {
        setCompareMode(next);
    }, []);
    const handleOpenGanttFull = useCallback(() => {
        setGanttFull(true);
    }, []);
    const handleOpenChartTrend = useCallback(() => {
        setChartFull('trend');
    }, []);
    const handleOpenChartFever = useCallback(() => {
        setChartFull('fever');
    }, []);
    const handleCloseGanttFull = useCallback(() => {
        setGanttFull(false);
    }, []);
    const handleCloseChartFull = useCallback(() => {
        setChartFull(null);
    }, []);
    const handleGanttFullSelectTask = useCallback((taskId) => {
        setSelectedTaskId(taskId);
        setInspectorMode('task');
    }, []);
    const handleGanttFullFilterChange = useCallback((next) => {
        setFilter(next);
    }, []);
    // ── レンダリング ─────────────────────────────────────────────────────────
    const showLoading = evmQuery.isLoading && projectId !== null;
    const showError = evmQuery.isError;
    return (_jsxs("div", { style: {
            height: '100vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: EVM.paper,
            color: EVM.ink,
            fontFamily: EVM.font,
        }, children: [_jsx(TopBar, { projects: topBarProjects, activeProjectId: projectId, activeProject: activeProject, baseDate: baseDate, projectMenuOpen: projectMenuOpen, datePickerOpen: datePickerOpen, onProjectChange: handleProjectChange, onBaseDateChange: handleBaseDateChange, onToggleProjectMenu: handleToggleProjectMenu, onToggleDatePicker: handleToggleDatePicker, onDismissPopovers: handleDismissPopovers }), _jsxs("div", { style: { flex: 1, display: 'flex', minHeight: 0 }, children: [_jsx(ProjectRail, { projects: railProjects, activeProjectId: projectId, members: memberInfos, assignees: assignees, inspectorMode: inspectorMode, inspectorMemberId: inspectorMemberId, onProjectChange: handleProjectChange, onMemberSelect: handleMemberSelect }), _jsxs("main", { style: {
                            flex: 1,
                            overflow: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                        }, children: [showError && (_jsxs("div", { style: {
                                    margin: 24,
                                    padding: 16,
                                    background: EVM.critSoft,
                                    border: `1px solid #e0b8a6`,
                                    borderRadius: 6,
                                    color: EVM.crit,
                                    fontSize: 13,
                                }, children: ["EVM \u30C7\u30FC\u30BF\u306E\u53D6\u5F97\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F:", ' ', evmQuery.error?.message ?? '不明なエラー'] })), !showError && data && activeProject && (_jsxs(_Fragment, { children: [_jsx(SummaryStrip, { project: activeProject, summary: data.summary, prevDay: data.prevDay, compareMode: compareMode, onCompareModeChange: handleCompareModeChange, progress: projectProgress, remainingDays: remainingDays }), data.alerts.length > 0 ? (_jsx(AlertStrip, { alerts: data.alerts, onJump: handleAlertJump })) : (_jsxs("div", { style: {
                                            background: EVM.brandSoft,
                                            borderBottom: `1px solid #cee08a`,
                                            padding: '8px 24px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            fontSize: 12,
                                            color: EVM.brandDeep,
                                        }, children: [_jsx("div", { style: {
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    background: EVM.brandDeep,
                                                    color: '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    fontSize: 11,
                                                }, children: "\u2713" }), _jsx("span", { style: { fontWeight: 600, letterSpacing: '0.02em' }, children: "HEALTHY" }), _jsx("span", { children: "\u9045\u5EF6\u30FB\u8B66\u544A\u306F\u691C\u51FA\u3055\u308C\u3066\u3044\u307E\u305B\u3093" })] })), _jsxs("div", { style: {
                                            background: EVM.card,
                                            margin: 24,
                                            marginBottom: 12,
                                            border: `1px solid ${EVM.rule}`,
                                            borderRadius: 6,
                                            overflow: 'hidden',
                                            flex: '0 0 auto',
                                        }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    padding: '14px 20px',
                                                    borderBottom: `1px solid ${EVM.rule}`,
                                                }, children: [_jsx(Eyebrow, { children: "Tasks \u00B7 WBS" }), _jsxs("span", { style: { fontSize: 13, color: EVM.ink, fontWeight: 500 }, children: [tasks.filter((t) => t.leaf || t.buffer).length, " leaf / ", tasks.length, " total"] }), _jsx("div", { style: { flex: 1 } }), _jsxs("div", { style: {
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 14,
                                                            fontSize: 11,
                                                            color: EVM.ink3,
                                                        }, children: [_jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsx(Dot, { tone: "critical" }), " SPI<0.8"] }), _jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsx(Dot, { tone: "warning" }), " <0.9"] }), _jsxs("span", { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: {
                                                                            width: 8,
                                                                            height: 8,
                                                                            borderRadius: '50%',
                                                                            background: '#3d6f9f',
                                                                            display: 'inline-block',
                                                                        } }), "\u22650.9"] })] }), _jsx("div", { style: { width: 1, height: 18, background: EVM.rule, marginLeft: 4 } }), _jsx("button", { type: "button", onClick: handleOpenGanttFull, title: "WBS\u3092\u5168\u753B\u9762\u3067\u8868\u793A", className: "evm-btn", style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            padding: '6px 10px',
                                                            borderRadius: 4,
                                                            background: EVM.paperWarm,
                                                            border: `1px solid ${EVM.rule}`,
                                                            cursor: 'pointer',
                                                            fontFamily: 'inherit',
                                                            fontSize: 11.5,
                                                            color: EVM.ink2,
                                                            fontWeight: 500,
                                                        }, children: _jsx("span", { children: "\u5168\u753B\u9762\u3067\u898B\u308B" }) })] }), _jsx("div", { style: { padding: '8px 12px 12px' }, children: _jsx(GanttChart, { tasks: tasks, gantt: data.gantt, selectedTaskId: selectedTaskId, onTaskClick: handleTaskClick }) })] }), _jsxs("div", { style: {
                                            display: 'flex',
                                            gap: 12,
                                            padding: '0 24px 24px',
                                            flex: '0 0 auto',
                                        }, children: [_jsxs("div", { style: {
                                                    flex: 1.2,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    background: EVM.card,
                                                    border: `1px solid ${EVM.rule}`,
                                                    borderRadius: 6,
                                                    overflow: 'hidden',
                                                }, children: [_jsxs("div", { style: {
                                                            padding: '14px 20px',
                                                            borderBottom: `1px solid ${EVM.rule}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 12,
                                                        }, children: [_jsx(Eyebrow, { children: "Trend \u00B7 Snapshots \u00D7 Time" }), _jsx("span", { style: { fontSize: 13, color: EVM.ink, fontWeight: 500 }, children: "SPI / CPI \u63A8\u79FB" }), _jsx("div", { style: { flex: 1 } }), _jsxs("span", { style: { fontSize: 11, color: EVM.ink3 }, children: ["\u904E\u53BB ", data.spiTrend.length, " \u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8"] }), _jsx("div", { style: { width: 1, height: 18, background: EVM.rule, marginLeft: 4 } }), _jsx("button", { type: "button", onClick: handleOpenChartTrend, title: "\u5168\u753B\u9762\u3067\u8868\u793A", className: "evm-btn", style: {
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                    padding: '6px 10px',
                                                                    borderRadius: 4,
                                                                    background: EVM.paperWarm,
                                                                    border: `1px solid ${EVM.rule}`,
                                                                    cursor: 'pointer',
                                                                    fontFamily: 'inherit',
                                                                    fontSize: 11.5,
                                                                    color: EVM.ink2,
                                                                    fontWeight: 500,
                                                                }, children: _jsx("span", { children: "\u5168\u753B\u9762\u3067\u898B\u308B" }) })] }), _jsx("div", { style: {
                                                            padding: '14px 16px 8px',
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }, children: _jsx(SpiTrendChart, { data: data.spiTrend, w: 620, h: 210 }) })] }), _jsxs("div", { style: {
                                                    flex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    background: EVM.card,
                                                    border: `1px solid ${EVM.rule}`,
                                                    borderRadius: 6,
                                                    overflow: 'hidden',
                                                }, children: [_jsxs("div", { style: {
                                                            padding: '14px 20px',
                                                            borderBottom: `1px solid ${EVM.rule}`,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 12,
                                                        }, children: [_jsx(Eyebrow, { children: "CCPM Fever" }), _jsx("span", { style: { fontSize: 13, color: EVM.ink, fontWeight: 500 }, children: "\u30D0\u30C3\u30D5\u30A1\u6D88\u8CBB vs \u5B8C\u4E86\u7387" }), _jsx("div", { style: { flex: 1 } }), data.fever ? (_jsx(Pill, { tone: data.fever.zone === 'GREEN'
                                                                    ? 'brand'
                                                                    : data.fever.zone === 'YELLOW'
                                                                        ? 'warning'
                                                                        : 'critical', children: data.fever.zone })) : (_jsx(Pill, { tone: "na", children: "N/A" })), _jsx("div", { style: { width: 1, height: 18, background: EVM.rule, marginLeft: 4 } }), _jsx("button", { type: "button", onClick: handleOpenChartFever, title: "\u5168\u753B\u9762\u3067\u8868\u793A", className: "evm-btn", style: {
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 6,
                                                                    padding: '6px 10px',
                                                                    borderRadius: 4,
                                                                    background: EVM.paperWarm,
                                                                    border: `1px solid ${EVM.rule}`,
                                                                    cursor: 'pointer',
                                                                    fontFamily: 'inherit',
                                                                    fontSize: 11.5,
                                                                    color: EVM.ink2,
                                                                    fontWeight: 500,
                                                                }, children: _jsx("span", { children: "\u5168\u753B\u9762\u3067\u898B\u308B" }) })] }), _jsx("div", { style: {
                                                            padding: '8px 12px',
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }, children: _jsx(FeverChart, { data: data.fever, w: 400, h: 220 }) })] })] })] })), !showError && (showLoading || !data || !activeProject) && (_jsx("div", { style: {
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: EVM.ink3,
                                    fontSize: 13,
                                    fontStyle: 'italic',
                                    fontFamily: EVM.fontSerif,
                                    padding: 60,
                                }, children: showLoading
                                    ? 'EVM を計算中...'
                                    : projectId === null
                                        ? 'プロジェクトを選択してください'
                                        : 'プロジェクト情報を読み込み中...' }))] }), data && activeProject && selectedTask && taskMetrics && (_jsx(Inspector, { mode: inspectorMode, task: selectedTask, taskMetrics: taskMetrics, taskTone: taskTone, project: activeProject, tasks: tasks, assignees: assignees, members: memberInfos, memberId: inspectorMemberId, compareMode: compareMode, prevDay: data.prevDay, prevTaskMetrics: prevTaskMetrics, onSwitchTask: handleSwitchTask, onSwitchMember: handleSwitchMember, onSwitchTeam: handleSwitchTeam }))] }), ganttFull && data && activeProject && (_jsx(GanttFullscreen, { project: activeProject, tasks: tasks, assignees: assignees, gantt: data.gantt, selectedTaskId: selectedTaskId, filter: filter, baseDate: baseDate, onSelectTask: handleGanttFullSelectTask, onFilterChange: handleGanttFullFilterChange, onClose: handleCloseGanttFull })), chartFull !== null && data && activeProject && (_jsx(ChartFullscreen, { type: chartFull, project: activeProject, spiTrend: data.spiTrend, fever: data.fever, onClose: handleCloseChartFull }))] }));
}
