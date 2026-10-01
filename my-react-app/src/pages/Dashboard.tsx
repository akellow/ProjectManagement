import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

type Project = {
    projectId: number;
    name: string;
    endDate: string;
};

type ProjectTask = {
    projectTaskId: number;
    title: string;
    status: string;
    endDate: string;
};

type Risk = {
    riskId: number;
    description: string;
    impact: string;
};

type Milestone = {
    milestoneId: number;
    dueDate: string;
    status: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            api.get<Project[]>("/Projects"),
            api.get<ProjectTask[]>("/ProjectTasks"),
            api.get<Risk[]>("/Risks"),
            api.get<Milestone[]>("/Milestones"),
        ])
            .then(([projectResponse, taskResponse, riskResponse, milestoneResponse]) => {
                setProjects(projectResponse.data);
                setTasks(taskResponse.data);
                setRisks(riskResponse.data);
                setMilestones(milestoneResponse.data);
            })
            .catch((loadError: unknown) => {
                const status = axios.isAxiosError(loadError) ? loadError.response?.status : undefined;
                setError(status ? `Unable to load dashboard data (HTTP ${status}).` : "Unable to load dashboard data.");
            })
            .finally(() => setIsLoading(false));
    }, []);

    const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
    const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const upcomingDeadlines = [...projects, ...tasks, ...milestones].filter((item) => {
        const dateValue = "endDate" in item ? item.endDate : "dueDate" in item ? item.dueDate : "";
        const date = new Date(dateValue).getTime();
        const now = Date.now();
        return date >= now && date <= now + 7 * 24 * 60 * 60 * 1000;
    }).length;

    return (
        <Box sx={{ maxWidth: 1200, mx: "auto" }}>
            <Box sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h3" component="h1">Your dashboard</Typography>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {isLoading ? <CircularProgress /> : (
                <>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
                        {[
                            ["Projects", projects.length, "Across the workspace"],
                            ["Task progress", `${progress}%`, `${completedTasks} of ${tasks.length} complete`],
                            ["Deadlines", upcomingDeadlines, "Due in the next 7 days"],
                            ["Open risks", risks.length, "Items needing attention"],
                        ].map(([label, value, detail]) => (
                            <Paper key={label} sx={{ p: 2.5 }}>
                                <Typography color="text.secondary" variant="body2">{label}</Typography>
                                <Typography variant="h4" sx={{ my: 1 }}>{value}</Typography>
                                <Typography variant="body2" color="text.secondary">{detail}</Typography>
                            </Paper>
                        ))}
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.35fr 1fr" }, gap: 2 }}>
                        <Paper sx={{ p: 3 }}>
                            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                                <Typography variant="h6">Recent tasks</Typography>
                                <Button size="small" onClick={() => navigate("/tasks")}>View all</Button>
                            </Stack>
                            {tasks.slice(0, 5).map((task) => (
                                <Stack key={task.projectTaskId} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
                                    <Box><Typography>{task.title}</Typography><Typography variant="body2" color="text.secondary">Due {formatDate(task.endDate)}</Typography></Box>
                                    <Chip size="small" label={task.status} color={task.status.toLowerCase() === "completed" ? "success" : "default"} />
                                </Stack>
                            ))}
                            {!tasks.length && <Typography color="text.secondary">No tasks have been added yet.</Typography>}
                        </Paper>

                       
                    </Box>
                </>
            )}
        </Box>
    );
}

function formatDate(value: string) {
    if (!value) return "No date";
    return new Date(value).toLocaleDateString();
}