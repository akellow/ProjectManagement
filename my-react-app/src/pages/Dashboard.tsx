import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, Typography } from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { formatEATDate, getEATDate } from "../utils/dateTime";
import { useAuth } from "../context/AuthContext";
import { getDashboardUserName } from "../utils/profile";

type Project = {
    projectId: number;
    name: string;
    endDate: string;
    status: string;
};

type ProjectTask = {
    projectTaskId: number;
    title: string;
    status: string;
    endDate: string;
    projectId: number;
};

type Risk = {
    riskId: number;
    description: string;
    impact: string;
};

type Milestone = {
    milestoneId: number;
    name: string;
    dueDate: string;
    status: string;
}

type DashboardPanel = "projects" | "tasks" | "deadlines" | "risks";
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
    const [risks, setRisks] = useState<Risk[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [activePanel, setActivePanel] = useState<DashboardPanel | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadDashboard = async () => {
            try {
                const [projectResponse, taskResponse, riskResponse, milestoneResponse] = await Promise.all([
                    api.get<Project[]>("/Projects"),
                    api.get<ProjectTask[]>("/ProjectTasks"),
                    api.get<Risk[]>("/Risks"),
                    api.get<Milestone[]>("/Milestones"),
                ]);
                if (!isMounted) return;
                setProjects(projectResponse.data);
                setTasks(taskResponse.data);
                setRisks(riskResponse.data);
                setMilestones(milestoneResponse.data);
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
    }, []);

    const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
    const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const today = getEATDate(new Date());
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

function deadlineReminder(status: string, dueDate: string, today: string) {
    if (status.toLowerCase() === "completed" || !hasDeadline(dueDate)) return "";
    const days = daysUntil(dueDate, today);
    if (days < 0) return "Overdue";
    if (days <= 1) return "1-day reminder";
    if (days <= 3) return "3-day reminder";
    return "";
}
