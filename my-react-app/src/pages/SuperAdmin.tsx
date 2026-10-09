import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type User = { id: string; userName: string; email: string; roles: string[]; source: "identity" | "supabase" };
type Project = { projectId: number };
type Task = { projectTaskId: number; status: string };
type Invitation = { id: string; email: string; role: string; invitedBy: string; expiresAt: string };
type ReportType = "portfolio" | "schedule" | "risks" | "resources";
type AiReport = { reportType: ReportType; report: string };

const reportTypes: { value: ReportType; label: string }[] = [
  { value: "portfolio", label: "Portfolio overview" },
  { value: "schedule", label: "Task and schedule" },
  { value: "risks", label: "Project risks" },
  { value: "resources", label: "Resources and recorded costs" },
];

export default function SuperAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userMessage, setUserMessage] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [reportType, setReportType] = useState<ReportType>("portfolio");
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<User[]>("/admin/users"), api.get<Project[]>("/Projects"), api.get<Task[]>("/ProjectTasks"), api.get<Invitation[]>("/admin/invitations"),
    ]).then(([userResponse, projectResponse, taskResponse, invitationResponse]) => {
      setUsers(userResponse.data); setProjects(projectResponse.data); setTasks(taskResponse.data); setInvitations(invitationResponse.data);
    }).catch((loadError: any) => setError(readApiError(loadError, "Unable to load superadmin data. Check that this account has superadmin access."))).finally(() => setIsLoading(false));
  }, []);

  const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
  const registeredUsers = users;

  async function changeRole(userId: string, role: string) {
    try {
      await api.put(`/admin/users/${userId}/role`, { role });
      const response = await api.get<User[]>("/admin/users");
      setUsers(response.data); setUserMessage("Role updated. The user must sign in again to receive the new permissions.");
    } catch (error: any) { setUserMessage(readApiError(error, "Unable to update role.")); }
  }

  async function deleteUser(userId: string) {
    if (!window.confirm("Delete this user account?")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter((user) => user.id !== userId));
      setUserMessage("Account deleted.");
    } catch (error: any) { setUserMessage(readApiError(error, "Unable to delete account.")); }
  }

  async function createInvitation(event: React.FormEvent) {
    event.preventDefault();
    try { const response = await api.post<Invitation>("/admin/invitations", { email: inviteEmail, role: inviteRole }); setInvitations([response.data, ...invitations]); setInviteEmail(""); setUserMessage("Supabase invitation email sent."); } catch (error: any) { setUserMessage(readApiError(error, "Unable to send invitation.")); }
  }

  async function generateReport(event: React.FormEvent) {
    event.preventDefault();
    setReportError("");
    setAiReport(null);
    setIsGeneratingReport(true);
    try {
      const response = await api.post<AiReport>("/admin/reports/generate", { reportType });
      setAiReport(response.data);
    } catch (error: any) {
      setReportError(readApiError(error, "Unable to generate the AI report."));
    } finally {
      setIsGeneratingReport(false);
    }
  }

  return <Box sx={{ maxWidth: 1200, mx: "auto" }}>
    <Typography variant="overline" color="primary">Administration</Typography>
    <Typography variant="h3" component="h1">Superadmin dashboard</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>System-wide visibility for users, delivery, and workspace health.</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
            {[["Users", registeredUsers.length], ["Projects", projects.length], ["Tasks", tasks.length], ["Completed tasks", completedTasks]].map(([label, value]) => <Paper key={label} sx={{ p: 2.5 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography></Paper>)}
      </Box>
      <Paper component="form" onSubmit={generateReport} sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6">AI-generated reports</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generate a report from aggregated project metrics. Project names and metrics are sent to OpenAI; employee contact details are not included.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
          <Select<ReportType>
            value={reportType}
            onChange={(event) => {
              const selected = reportTypes.find((option) => option.value === event.target.value);
              if (selected) setReportType(selected.value);
            }}
            aria-label="Report type"
            sx={{ minWidth: 260 }}
          >
            {reportTypes.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
          <Button type="submit" variant="contained" disabled={isGeneratingReport}>
            {isGeneratingReport ? "Generating..." : "Generate report"}
          </Button>
        </Stack>
        {reportError && <Alert severity="error" sx={{ mt: 2 }}>{reportError}</Alert>}
        {aiReport && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              {reportTypes.find((option) => option.value === aiReport.reportType)?.label ?? "Generated report"}
            </Typography>
            <Box component="pre" sx={{ m: 0, font: "inherit", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {aiReport.report}
            </Box>
          </Paper>
        )}
      </Paper>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
        <Paper sx={{ p: 3, flex: 1 }}><Typography variant="h6" sx={{ mb: 2 }}>Registered users</Typography>{userMessage && <Alert severity="info" sx={{ mb: 2 }}>{userMessage}</Alert>}{registeredUsers.map((registeredUser) => <Stack key={`${registeredUser.source}-${registeredUser.id}`} direction={{ xs: "column", sm: "row" }} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider", justifyContent: "space-between", gap: 1 }}><Box><Typography>{registeredUser.userName}</Typography><Typography variant="body2" color="text.secondary">{registeredUser.email} · {registeredUser.roles.join(", ") || "user"}{registeredUser.source === "supabase" ? " · Supabase" : ""}</Typography></Box><Stack direction="row" spacing={1}><Select size="small" value={registeredUser.roles[0] || "user"} onChange={(event) => changeRole(registeredUser.id, event.target.value)}><MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem><MenuItem value="superadmin">Superadmin</MenuItem></Select><Button size="small" color="error" onClick={() => deleteUser(registeredUser.id)}>Delete</Button></Stack></Stack>)}{!registeredUsers.length && <Typography color="text.secondary">No users found.</Typography>}</Paper>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>System logs</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Review recent administrative activity.</Typography>
          <Button variant="outlined" component={Link} to="/superadmin/logs">View logs</Button>
        </Paper>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, mt: 2 }}>
        <Paper component="form" onSubmit={createInvitation} sx={{ p: 3, flex: 1 }}><Typography variant="h6">Invite organization member</Typography><Stack spacing={2} sx={{ mt: 2 }}><TextField label="Email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /><Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{["user", "admin", ...(user?.app_metadata?.role === "superadmin" ? ["superadmin"] : [])].map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select><Button type="submit" variant="contained">Create invitation</Button></Stack></Paper>
      </Stack>
    </>}
  </Box>;
}

function readApiError(error: any, fallback: string) {
  const data = error.response?.data;
  return Array.isArray(data)
    ? data[0]?.description || fallback
    : typeof data === "string"
      ? data
      : data?.detail || data?.title || fallback;
}