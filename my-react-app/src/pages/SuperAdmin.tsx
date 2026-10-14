import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import api from "../services/api";
import { jsPDF } from "jspdf";

type User = { id: string; userName: string; email: string; roles: string[]; source: "identity" | "supabase" };
type Project = { projectId: number };
type Task = { projectTaskId: number; status: string };
type ReportType = "portfolio" | "schedule" | "risks" | "resources";
type AiReport = { reportType: ReportType; report: string };

const reportTypes: { value: ReportType; label: string }[] = [
  { value: "portfolio", label: "Portfolio overview" },
  { value: "schedule", label: "Task and schedule" },
  { value: "risks", label: "Project risks" },
  { value: "resources", label: "Resources and recorded costs" },
];

export default function SuperAdmin() {
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<ReportType>("portfolio");
  const [aiReport, setAiReport] = useState<AiReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<User[]>("/admin/users"), api.get<Project[]>("/Projects"), api.get<Task[]>("/ProjectTasks"),
    ]).then(([userResponse, projectResponse, taskResponse]) => {
      setUsers(userResponse.data); setProjects(projectResponse.data); setTasks(taskResponse.data);
    }).catch((loadError: any) => setError(readApiError(loadError, "Unable to load superadmin data. Check that this account has superadmin access."))).finally(() => setIsLoading(false));
  }, []);

  const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
  const registeredUsers = users;
  const inviteMessage = (location.state as { message?: string } | null)?.message;

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

  function downloadReportPdf() {
    if (!aiReport) return;
    const document = new jsPDF();
    const title = reportTypes.find((option) => option.value === aiReport.reportType)?.label ?? "Generated report";
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    const margin = 18;
    let y = margin;

    document.setFont("helvetica", "bold");
    document.setFontSize(18);
    document.text(title, margin, y);
    y += 9;
    document.setFont("helvetica", "normal");
    document.setFontSize(10);
    document.setTextColor(100);
    document.text(`Generated ${new Date().toLocaleString()}`, margin, y);
    y += 10;
    document.setTextColor(25);
    document.setFontSize(11);

    for (const paragraph of aiReport.report.split(/\r?\n/)) {
      const lines = document.splitTextToSize(paragraph || " ", pageWidth - margin * 2);
      for (const line of lines) {
        if (y > pageHeight - margin) {
          document.addPage();
          y = margin;
        }
        document.text(line, margin, y);
        y += 6;
      }
    }

    document.save(`${aiReport.reportType}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return <Box sx={{ maxWidth: 1200, mx: "auto" }}>
    <Typography variant="overline" color="primary">Administration</Typography>
    <Typography variant="h3" component="h1">Superadmin dashboard</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>System-wide visibility for users, delivery, and workspace health.</Typography>
    {inviteMessage && <Alert severity="success" sx={{ mb: 3 }}>{inviteMessage}</Alert>}
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
            {[["Users", registeredUsers.length], ["Projects", projects.length], ["Tasks", tasks.length], ["Completed tasks", completedTasks]].map(([label, value]) => <Paper key={label} sx={{ p: 2.5 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography></Paper>)}
      </Box>
      <Paper component="form" onSubmit={generateReport} sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6">AI-generated reports</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Generate a report from aggregated project metrics. Project names and metrics are sent to Gemini; employee contact details are not included.
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
            <Button variant="outlined" sx={{ mb: 2 }} onClick={downloadReportPdf}>
              Download PDF
            </Button>
            <Box component="pre" sx={{ m: 0, font: "inherit", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {aiReport.report}
            </Box>
          </Paper>
        )}
      </Paper>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Registered users</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>View system accounts and manage user roles.</Typography>
          <Button variant="contained" component={Link} to="/superadmin/users">View system users</Button>
        </Paper>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>System logs</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Review recent administrative activity.</Typography>
          <Button variant="outlined" component={Link} to="/superadmin/logs">View logs</Button>
        </Paper>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, mt: 2 }}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Invite new users</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Invite a teammate by email and choose their initial system role.
          </Typography>
          <Button
            variant="contained"
            component={Link}
            to="/superadmin/invite"
            sx={{ width: { xs: "100%", sm: "auto" }, px: 3, py: 1.25, fontWeight: 700 }}
          >
            Invite new user
          </Button>
        </Paper>
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