import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatEATDate, getEATDate } from "../utils/dateTime";
import { useAuth } from "../context/AuthContext";
import { getDashboardUserName } from "../utils/profile";

type Project = {
    projectId: number;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
    budget: number;
};

type ProjectTask = {
    projectTaskId: number;
    title: string;
    status: string;
    priority: string;
    startDate: string;
    endDate: string;
    projectId: number;
};

type Employee = {
    employeeId: number;
    userId: string | null;
    name: string;
};

type Assignment = {
    taskId: number;
    employeeId: number;
    hoursAllocated: number;
};

type Risk = {
    riskId: number;
    description: string;
    impact: string;
};

type Milestone = {
    milestoneId: number;
    projectId: number;
    name: string;
    dueDate: string;
    status: string;
}

type DashboardPanel = "projects" | "tasks" | "deadlines" | "risks";
type WorkView = "kanban" | "timeline";
type PanelItem = {
    id: string;
    name: string;
    description: string;
    status?: string;
    reminder?: string;
    path: string;
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [activePanel, setActivePanel] = useState<DashboardPanel | null>(null);
    const [workView, setWorkView] = useState<WorkView>("kanban");

    useEffect(() => {
        let isMounted = true;
        const loadDashboard = async () => {
            try {
                const [projectResponse, taskResponse, riskResponse, milestoneResponse, employeeResponse, assignmentResponse] = await Promise.all([
                    api.get<Project[]>("/Projects"),
                    api.get<ProjectTask[]>("/ProjectTasks"),
                    api.get<Risk[]>("/Risks"),
                    api.get<Milestone[]>("/Milestones"),
                    api.get<Employee[]>("/Employees"),
                    api.get<Assignment[]>("/Assignments"),
                ]);
                if (!isMounted) return;
                setProjects(projectResponse.data);
                setTasks(taskResponse.data);
                setRisks(riskResponse.data);
                setMilestones(milestoneResponse.data);
                setEmployees(employeeResponse.data);
                setAssignments(assignmentResponse.data);
                setError("");
            } catch (loadError: unknown) {
                if (!isMounted) return;
                const status = axios.isAxiosError(loadError) ? loadError.response?.status : undefined;
                setError(status ? `Unable to load dashboard data (HTTP ${status}).` : "Unable to load dashboard data.");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void loadDashboard();
        const refreshTimer = window.setInterval(() => void loadDashboard(), 60_000);
        return () => {
            isMounted = false;
            window.clearInterval(refreshTimer);
        };
    }, [user?.id]);

    const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
    const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const today = getEATDate(new Date());
    const weekStart = startOfEATWeek(today);
    const weekEnd = addCalendarDays(weekStart, 6);
    const deadlines = [
        ...projects.map((project) => ({ id: `project-${project.projectId}`, name: project.name, type: "Project", dueDate: project.endDate, status: project.status, path: "/projects" })),
        ...tasks.map((task) => ({ id: `task-${task.projectTaskId}`, name: task.title, type: "Task", dueDate: task.endDate, status: task.status, path: "/tasks" })),
        ...milestones.map((milestone) => ({ id: `milestone-${milestone.milestoneId}`, name: milestone.name, type: "Milestone", dueDate: milestone.dueDate, status: milestone.status, path: "/milestones" })),
    ].filter((item) => hasDeadline(item.dueDate))
        .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime());
    const visibleDeadlines = deadlines.filter((item) => !(item.type === "Task" && item.status.toLowerCase() === "completed"));
    const overdueDeadlines = visibleDeadlines.filter((item) => item.status.toLowerCase() !== "completed" && getEATDate(item.dueDate) < today);
    const oneDayReminders = visibleDeadlines.filter((item) =>
        item.status.toLowerCase() !== "completed" && daysUntil(item.dueDate, today) >= 0 && daysUntil(item.dueDate, today) <= 1);
    const threeDayReminders = visibleDeadlines.filter((item) =>
        item.status.toLowerCase() !== "completed" && daysUntil(item.dueDate, today) > 1 && daysUntil(item.dueDate, today) <= 3);
    const employeeIds = new Set(employees.filter((employee) => employee.userId === user?.id).map((employee) => employee.employeeId));
    const myTaskIds = new Set(assignments.filter((assignment) => employeeIds.has(assignment.employeeId)).map((assignment) => assignment.taskId));
    const myTasksDueThisWeek = tasks
        .filter((task) => myTaskIds.has(task.projectTaskId)
            && hasDeadline(task.endDate)
            && getEATDate(task.endDate) >= weekStart
            && getEATDate(task.endDate) <= weekEnd)
        .sort((left, right) => new Date(left.endDate).getTime() - new Date(right.endDate).getTime());
    const taskStatuses = ["Pending", "In Progress", "Overdue", "Completed"];
    const timelineItems = [
        ...projects.map((project) => ({
            id: `project-${project.projectId}`,
            name: project.name,
            type: "Project",
            startDate: project.startDate,
            endDate: project.endDate,
            status: project.status,
            detail: `Budget: KSh ${new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(project.budget)}`,
            path: "/projects",
        })),
        ...tasks.map((task) => {
            const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.projectTaskId);
            const assigneeNames = taskAssignments.map((assignment) =>
                employees.find((employee) => employee.employeeId === assignment.employeeId)?.name ?? `Employee ${assignment.employeeId}`);
            return {
                id: `task-${task.projectTaskId}`,
                name: task.title,
                type: "Task",
                startDate: task.startDate,
                endDate: task.endDate,
                status: task.status,
                detail: `${projects.find((project) => project.projectId === task.projectId)?.name ?? "Project"} · ${task.priority || "Normal"} priority${assigneeNames.length ? ` · ${assigneeNames.join(", ")}` : " · Unassigned"}${taskAssignments.length ? ` · ${formatAllocatedHours(taskAssignments.reduce((total, assignment) => total + assignment.hoursAllocated, 0))} allocated` : ""}`,
                path: "/tasks",
            };
        }),
        ...milestones.map((milestone) => ({
            id: `milestone-${milestone.milestoneId}`,
            name: milestone.name,
            type: "Milestone",
            startDate: milestone.dueDate,
            endDate: milestone.dueDate,
            status: milestone.status,
            detail: `${projects.find((project) => project.projectId === milestone.projectId)?.name ?? "Project"} · Due ${hasDeadline(milestone.dueDate) ? formatEATDate(milestone.dueDate) : "Not set"}`,
            path: "/milestones",
        })),
    ];
    const datedTimelineItems = timelineItems.filter((item) => hasDeadline(item.startDate) || hasDeadline(item.endDate));
    const timelineStart = datedTimelineItems.length
        ? minDate([...datedTimelineItems.map((item) => item.startDate), ...datedTimelineItems.map((item) => item.endDate)].filter(hasDeadline))
        : weekStart;
    const timelineEnd = datedTimelineItems.length
        ? maxDate([...datedTimelineItems.map((item) => item.startDate), ...datedTimelineItems.map((item) => item.endDate)].filter(hasDeadline))
        : weekEnd;
    const timelineDays = Math.max(1, calendarDaysBetween(timelineStart, timelineEnd) + 1);
    const timelineWidth = Math.max(900, timelineDays * 22);
    const timelineHeaders = Array.from({ length: timelineDays }, (_, index) => addCalendarDays(timelineStart, index));
    const panelItems: Record<DashboardPanel, PanelItem[]> = {
        projects: projects.map((project) => ({
            id: `project-${project.projectId}`,
            name: project.name,
            description: hasDeadline(project.endDate) ? `Ends ${formatEATDate(project.endDate)}` : "No deadline set",
            status: deadlineStatus(project.status, project.endDate, today),
            path: "/projects",
        })),
        tasks: tasks.map((task) => ({
            id: `task-${task.projectTaskId}`,
            name: task.title,
            description: hasDeadline(task.endDate) ? `Due ${formatEATDate(task.endDate)}` : "No deadline set",
            status: deadlineStatus(task.status, task.endDate, today),
            path: "/tasks",
        })),
        deadlines: visibleDeadlines.map((item) => ({
            id: item.id,
            name: item.name,
            description: `${item.type} · Due ${formatEATDate(item.dueDate)}`,
            status: deadlineStatus(item.status, item.dueDate, today),
            reminder: deadlineReminder(item.status, item.dueDate, today),
            path: item.path,
        })),
        risks: risks.map((risk) => ({
            id: `risk-${risk.riskId}`,
            name: risk.description,
            description: `Impact: ${risk.impact}`,
            path: "/risks",
        })),
    };
    const panelTitles: Record<DashboardPanel, string> = {
        projects: "Projects",
        tasks: "Tasks",
        deadlines: "Deadlines",
        risks: "Open risks",
    };
    const selectedItems = activePanel ? panelItems[activePanel] : [];
    const summaryCards: { key: DashboardPanel; label: string; value: string | number; detail: string }[] = [
        { key: "projects", label: "Projects", value: projects.length, detail: "Across the workspace" },
        { key: "tasks", label: "Task progress", value: `${progress}%`, detail: `${completedTasks} of ${tasks.length} complete` },
        { key: "deadlines", label: "Deadlines", value: visibleDeadlines.length, detail: `${overdueDeadlines.length} overdue · ${oneDayReminders.length} due within 1 day · ${threeDayReminders.length} due within 3 days` },
        { key: "risks", label: "Open risks", value: risks.length, detail: "Items needing attention" },
    ];

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto" }}>
            <Box sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h3" component="h1">{getDashboardUserName(user)}'s Dashboard</Typography>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {isLoading ? <CircularProgress /> : (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
                        {summaryCards.map((card) => (
                            <Paper
                                key={card.key}
                                component="button"
                                type="button"
                                onClick={() => setActivePanel(card.key)}
                                aria-haspopup="dialog"
                                sx={{ p: 2.5, color: "inherit", textAlign: "left", border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { borderColor: "primary.main", boxShadow: 3 }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" } }}
                            >
                                <Typography color="text.secondary" variant="body2">{card.label}</Typography>
                                <Typography variant="h4" sx={{ my: 1 }}>{card.value}</Typography>
                                <Typography variant="body2" color="text.secondary">{card.detail}</Typography>
                            </Paper>
                        ))}
                    </Box>

                    <Paper sx={{ p: 3, mb: 2 }}>
                        <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2, mb: 2 }}>
                            <Box>
                                <Typography variant="h6">Work overview</Typography>
                                <Typography variant="body2" color="text.secondary">Track project schedules, task ownership, priorities, and progress.</Typography>
                            </Box>
                            <ToggleButtonGroup
                                value={workView}
                                exclusive
                                size="small"
                                aria-label="Work overview"
                                onChange={(_, value: WorkView | null) => { if (value) setWorkView(value); }}
                            >
                                <ToggleButton value="kanban">Kanban board</ToggleButton>
                                <ToggleButton value="timeline">Timeline</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                        {workView === "kanban" ? (
                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(220px, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 1.5, overflowX: "auto", alignItems: "start" }}>
                                {taskStatuses.map((status) => {
                                    const columnTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === status);
                                    return (
                                        <Paper key={status} variant="outlined" sx={{ p: 1.5, minHeight: 170, bgcolor: "action.hover" }}>
                                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1.25 }}>
                                                <Typography sx={{ fontWeight: 700 }}>{status}</Typography>
                                                <Chip size="small" label={columnTasks.length} />
                                            </Stack>
                                            <Stack spacing={1}>
                                                {columnTasks.map((task) => {
                                                    const taskAssignments = assignments.filter((assignment) => assignment.taskId === task.projectTaskId);
                                                    const assigneeNames = taskAssignments.map((assignment) =>
                                                        employees.find((employee) => employee.employeeId === assignment.employeeId)?.name ?? `Employee ${assignment.employeeId}`);
                                                    return (
                                                        <Paper
                                                            key={task.projectTaskId}
                                                            component="button"
                                                            type="button"
                                                            onClick={() => navigate("/tasks")}
                                                            sx={{ textAlign: "left", color: "inherit", p: 1.5, cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
                                                        >
                                                            <Typography sx={{ fontWeight: 600 }}>{task.title}</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                {projects.find((project) => project.projectId === task.projectId)?.name ?? "Project"}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
                                                                <Chip size="small" variant="outlined" label={`${task.priority || "Normal"} priority`} />
                                                                <Chip size="small" variant="outlined" label={hasDeadline(task.endDate) ? `Due ${formatEATDate(task.endDate)}` : "No deadline"} />
                                                                {assigneeNames.map((name) => <Chip key={name} size="small" label={name} />)}
                                                                {taskAssignments.length > 0 && <Chip size="small" variant="outlined" label={`${formatAllocatedHours(taskAssignments.reduce((total, assignment) => total + assignment.hoursAllocated, 0))} allocated`} />}
                                                            </Stack>
                                                        </Paper>
                                                    );
                                                })}
                                                {!columnTasks.length && <Typography variant="body2" color="text.secondary">No tasks</Typography>}
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Box>
                        ) : (
                            <Box sx={{ overflowX: "auto" }}>
                                <Box sx={{ minWidth: 1100 }}>
                                    <Box sx={{ display: "grid", gridTemplateColumns: `minmax(280px, 0.8fr) minmax(${timelineWidth}px, 2fr)`, borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
                                        <Typography variant="caption" color="text.secondary">Item · Project / priority / assignees</Typography>
                                        <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${timelineDays}, minmax(22px, 1fr))` }}>
                                            {timelineHeaders.map((date) => <Typography key={date} variant="caption" color="text.secondary" sx={{ textAlign: "center", whiteSpace: "nowrap" }}>{timelineLabel(date, timelineDays)}</Typography>)}
                                        </Box>
                                    </Box>
                                    {timelineItems.map((item) => {
                                        const hasStart = hasDeadline(item.startDate);
                                        const hasEnd = hasDeadline(item.endDate);
                                        const effectiveStart = hasStart ? item.startDate : item.endDate;
                                        const effectiveEnd = hasEnd ? item.endDate : item.startDate;
                                        const startOffset = Math.max(0, Math.min(timelineDays - 1, calendarDaysBetween(timelineStart, getEATDate(effectiveStart))));
                                        const endOffset = Math.max(startOffset, Math.min(timelineDays - 1, calendarDaysBetween(timelineStart, getEATDate(effectiveEnd))));
                                        const barWidth = Math.max(1, endOffset - startOffset + 1);
                                        const color = item.type === "Project" ? "primary" : item.type === "Milestone" ? "warning" : "success";
                                        const status = deadlineStatus(item.status, item.endDate, today);
                                        return (
                                            <Box key={item.id} sx={{ display: "grid", gridTemplateColumns: `minmax(280px, 0.8fr) minmax(${timelineWidth}px, 2fr)`, alignItems: "center", minHeight: 58, borderBottom: "1px solid", borderColor: "divider" }}>
                                                <Box sx={{ pr: 2, minWidth: 0 }}>
                                                    <Button size="small" onClick={() => navigate(item.path)} sx={{ p: 0, minWidth: 0, justifyContent: "flex-start", textAlign: "left", fontWeight: 600 }}>{item.name}</Button>
                                                    <Typography variant="caption" sx={{ display: "block" }} color="text.secondary" noWrap>{item.type} · {item.detail}</Typography>
                                                    <Typography variant="caption" sx={{ display: "block" }} color="text.secondary">{hasStart || hasEnd ? `${hasStart ? formatEATDate(item.startDate) : "Start unset"} – ${hasEnd ? formatEATDate(item.endDate) : "End unset"}` : "Schedule not set"}</Typography>
                                                    <Chip size="small" sx={{ mt: 0.5 }} label={status} color={status === "Overdue" ? "error" : status === "Completed" ? "success" : "default"} />
                                                </Box>
                                                <Box sx={{ height: 30, display: "grid", gridTemplateColumns: `repeat(${timelineDays}, minmax(22px, 1fr))`, alignItems: "center", backgroundImage: "linear-gradient(to right, transparent calc(100% - 1px), var(--mui-palette-divider) 1px)", backgroundSize: `${100 / timelineDays}% 100%` }}>
                                                    {(hasStart || hasEnd) && (
                                                        <Box
                                                            title={`${item.name}: ${item.status} · ${hasStart ? formatEATDate(item.startDate) : "Start unset"} – ${hasEnd ? formatEATDate(item.endDate) : "End unset"}`}
                                                            sx={{
                                                                gridColumn: `${startOffset + 1} / span ${barWidth}`,
                                                                height: item.type === "Milestone" ? 14 : 18,
                                                                borderRadius: item.type === "Milestone" ? 1 : 5,
                                                                bgcolor: status === "Overdue" ? "error.main" : `${color}.main`,
                                                                justifySelf: item.type === "Milestone" ? "center" : "stretch",
                                                                width: item.type === "Milestone" ? 14 : "auto",
                                                                transform: item.type === "Milestone" ? "rotate(45deg)" : "none",
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                    {!timelineItems.length && <Typography color="text.secondary" sx={{ py: 3 }}>No projects, tasks, or milestones to show.</Typography>}
                                </Box>
                            </Box>
                        )}
                    </Paper>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.35fr 1fr" }, gap: 2 }}>
                        <Paper sx={{ p: 3 }}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                <Typography variant="h6">Deadlines</Typography>
                                <Button size="small" onClick={() => navigate("/projects")}>View projects</Button>
                            </Stack>
                            {visibleDeadlines.map((item) => {
                                const status = deadlineStatus(item.status, item.dueDate, today);
                                const reminder = deadlineReminder(item.status, item.dueDate, today);
                                return (
                                <Stack key={item.id} component="button" type="button" direction="row" onClick={() => navigate(item.path)} sx={{ width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1, py: 1.25, border: 0, borderBottom: "1px solid", borderColor: "divider", color: "inherit", background: "transparent", textAlign: "left", cursor: "pointer" }}>
                                    <Box><Typography>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.type} · Due {formatEATDate(item.dueDate)}</Typography></Box>
                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                                        {reminder && <Chip size="small" label={reminder} color={reminder === "Overdue" ? "error" : "warning"} />}
                                        <Chip size="small" label={status} color={status.toLowerCase() === "completed" ? "success" : status.toLowerCase() === "overdue" ? "error" : "default"} />
                                    </Stack>
                                </Stack>
                                );
                            })}
                            {!visibleDeadlines.length && <Typography color="text.secondary">No outstanding deadlines to show.</Typography>}
                        </Paper>

                        <Paper sx={{ p: 3 }}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                <Typography variant="h6">My Tasks due this week</Typography>
                                <Typography variant="body2" color="text.secondary">{formatEATDate(`${weekStart}T00:00:00.000Z`)} – {formatEATDate(`${weekEnd}T00:00:00.000Z`)}</Typography>
                            </Stack>
                            {myTasksDueThisWeek.map((task) => (
                                <Stack key={task.projectTaskId} component="button" type="button" direction="row" onClick={() => navigate("/tasks")} sx={{ width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1, py: 1.25, border: 0, borderBottom: "1px solid", borderColor: "divider", color: "inherit", background: "transparent", textAlign: "left", cursor: "pointer" }}>
                                    <Box><Typography>{task.title}</Typography><Typography variant="body2" color="text.secondary">Due {formatEATDate(task.endDate)}</Typography></Box>
                                    <Chip size="small" label={deadlineStatus(task.status, task.endDate, today)} color={task.status.toLowerCase() === "completed" ? "success" : deadlineStatus(task.status, task.endDate, today) === "Overdue" ? "error" : "default"} />
                                </Stack>
                            ))}
                            {!myTasksDueThisWeek.length && <Typography color="text.secondary">You have no assigned tasks due this week.</Typography>}
                        </Paper>
                    </Box>
                </>
            )}
            <Dialog open={activePanel !== null} onClose={() => setActivePanel(null)} fullWidth maxWidth="sm" aria-labelledby="dashboard-panel-title">
                <DialogTitle id="dashboard-panel-title" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {activePanel ? panelTitles[activePanel] : ""}
                    <IconButton aria-label="Close" onClick={() => setActivePanel(null)}>×</IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={0.5}>
                        {selectedItems.map((item) => (
                            <Stack
                                key={item.id}
                                component="button"
                                type="button"
                                direction="row"
                                onClick={() => { setActivePanel(null); navigate(item.path); }}
                                sx={{ width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1, py: 1.25, px: 1, border: 0, borderBottom: "1px solid", borderColor: "divider", color: "inherit", background: "transparent", textAlign: "left", cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}
                            >
                                <Box><Typography>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.description}</Typography></Box>
                                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                                    {item.reminder && <Chip size="small" label={item.reminder} color={item.reminder === "Overdue" ? "error" : "warning"} />}
                                    {item.status && <Chip size="small" label={item.status} color={item.status.toLowerCase() === "completed" ? "success" : item.status.toLowerCase() === "overdue" ? "error" : "default"} />}
                                </Stack>
                            </Stack>
                        ))}
                        {activePanel && selectedItems.length === 0 && <Typography color="text.secondary">No {panelTitles[activePanel].toLowerCase()} to show.</Typography>}
                    </Stack>
                </DialogContent>
            </Dialog>
        </Box>
    );
}

function deadlineStatus(status: string, dueDate: string, today: string) {
    if (status.toLowerCase() === "completed") return "Completed";
    if (status.toLowerCase() === "overdue" || (hasDeadline(dueDate) && getEATDate(dueDate) < today)) return "Overdue";
    return status;
}

function hasDeadline(value: string | null | undefined) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.getUTCFullYear() > 1;
}

function daysUntil(dueDate: string, today: string) {
    const dueDay = Date.parse(`${getEATDate(dueDate)}T00:00:00Z`);
    const todayDay = Date.parse(`${today}T00:00:00Z`);
    return Math.round((dueDay - todayDay) / 86_400_000);
}

function startOfEATWeek(today: string) {
    const date = new Date(`${today}T00:00:00.000Z`);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    return date.toISOString().slice(0, 10);
}

function addCalendarDays(dateValue: string, days: number) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function calendarDaysBetween(startDate: string, endDate: string) {
    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    const end = Date.parse(`${endDate}T00:00:00.000Z`);
    return Math.round((end - start) / 86_400_000);
}

function minDate(dates: string[]) {
    return dates.reduce((earliest, date) => date < earliest ? date : earliest);
}

function maxDate(dates: string[]) {
    return dates.reduce((latest, date) => date > latest ? date : latest);
}

function timelineLabel(date: string, totalDays: number) {
    if (totalDays <= 35) {
        return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short" })
            .format(new Date(`${date}T00:00:00.000Z`));
    }
    const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    return dayOfWeek === 1 ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short" })
        .format(new Date(`${date}T00:00:00.000Z`)) : "";
}

function normalizeTaskStatus(status: string) {
    const normalized = status.trim().toLowerCase();
    if (normalized === "completed") return "Completed";
    if (normalized === "overdue") return "Overdue";
    if (normalized === "in progress") return "In Progress";
    return "Pending";
}

function formatAllocatedHours(hours: number) {
    if (!Number.isFinite(hours) || hours <= 0) return "0 hours";
    if (hours % 24 === 0) {
        const days = hours / 24;
        return `${days} ${days === 1 ? "day" : "days"}`;
    }
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function deadlineReminder(status: string, dueDate: string, today: string) {
    if (status.toLowerCase() === "completed" || !hasDeadline(dueDate)) return "";
    const days = daysUntil(dueDate, today);
    if (days < 0) return "Overdue";
    if (days <= 1) return "1-day reminder";
    if (days <= 3) return "3-day reminder";
    return "";
}
