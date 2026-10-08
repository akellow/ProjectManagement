import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type User = { id: string; userName: string; email: string; roles: string[]; source: "identity" | "supabase" };
type Project = { projectId: number };
type Task = { projectTaskId: number; status: string };
type Employee = { employeeId: number; name: string; role: string; contactInfo: string; userId: string | null };
type AuditEntry = { timestamp: string; actor: string; action: string; target: string };
type Invitation = { id: string; email: string; role: string; invitedBy: string; expiresAt: string };

export default function SuperAdmin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [userMessage, setUserMessage] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");

  useEffect(() => {
    Promise.all([
      api.get<User[]>("/admin/users"), api.get<Project[]>("/Projects"), api.get<Task[]>("/ProjectTasks"), api.get<Employee[]>("/Employees"), api.get<AuditEntry[]>("/admin/audit"), api.get<Invitation[]>("/admin/invitations"),
    ]).then(([userResponse, projectResponse, taskResponse, employeeResponse, auditResponse, invitationResponse]) => {
      setUsers(userResponse.data); setProjects(projectResponse.data); setTasks(taskResponse.data); setEmployees(employeeResponse.data); setAudit(auditResponse.data); setInvitations(invitationResponse.data);
    }).catch((loadError: any) => setError(readApiError(loadError, "Unable to load superadmin data. Check that this account has superadmin access."))).finally(() => setIsLoading(false));
  }, []);

  const completedTasks = tasks.filter((task) => task.status.toLowerCase() === "completed").length;
  const registeredUsers = users;

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    try {
      await api.post("/admin/users", { username: newUsername, email: newEmail, password: newUserPassword, role: newUserRole });
      const response = await api.get<User[]>("/admin/users");
      setUsers(response.data); setNewUsername(""); setNewEmail(""); setNewUserPassword(""); setNewUserRole("user"); setUserMessage("Account created.");
    } catch (error: any) { setUserMessage(readApiError(error, "Unable to create account.")); }
  }

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

  return <Box sx={{ maxWidth: 1200, mx: "auto" }}>
    <Typography variant="overline" color="primary">Administration</Typography>
    <Typography variant="h3" component="h1">Superadmin dashboard</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>System-wide visibility for users, delivery, and workspace health.</Typography>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {isLoading ? <CircularProgress /> : <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
            {[["Users", registeredUsers.length], ["Projects", projects.length], ["Tasks", tasks.length], ["Completed tasks", completedTasks]].map(([label, value]) => <Paper key={label} sx={{ p: 2.5 }}><Typography color="text.secondary">{label}</Typography><Typography variant="h4" sx={{ mt: 1 }}>{value}</Typography></Paper>)}
      </Box>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
        <Paper sx={{ p: 3, flex: 1 }}><Typography variant="h6" sx={{ mb: 2 }}>Registered users</Typography>{userMessage && <Alert severity="info" sx={{ mb: 2 }}>{userMessage}</Alert>}{registeredUsers.map((registeredUser) => <Stack key={`${registeredUser.source}-${registeredUser.id}`} direction={{ xs: "column", sm: "row" }} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider", justifyContent: "space-between", gap: 1 }}><Box><Typography>{registeredUser.userName}</Typography><Typography variant="body2" color="text.secondary">{registeredUser.email} · {registeredUser.roles.join(", ") || "user"}{registeredUser.source === "supabase" ? " · Supabase" : ""}</Typography></Box><Stack direction="row" spacing={1}><Select size="small" value={registeredUser.roles[0] || "user"} onChange={(event) => changeRole(registeredUser.id, event.target.value)}><MenuItem value="user">User</MenuItem><MenuItem value="admin">Admin</MenuItem><MenuItem value="superadmin">Superadmin</MenuItem></Select><Button size="small" color="error" onClick={() => deleteUser(registeredUser.id)}>Delete</Button></Stack></Stack>)}{!registeredUsers.length && <Typography color="text.secondary">No users found.</Typography>}</Paper>
        <Paper sx={{ p: 3, flex: 1 }}><Typography variant="h6" sx={{ mb: 2 }}>System health</Typography><Typography sx={{ mb: 1 }}>Employees: {employees.length}</Typography><Typography sx={{ mb: 1 }}>Task completion: {tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0}%</Typography><Typography color="text.secondary">Use the main workspace pages to manage records.</Typography></Paper>
      </Stack>
      <Paper component="form" onSubmit={createUser} sx={{ p: 3, mt: 2, maxWidth: 620 }}>
        <Typography variant="h6">Create account with role</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Only superadmins can create accounts with privileged roles.</Typography>
        <Stack spacing={2}>
          <TextField label="Username" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} required />
          <TextField label="Email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
          <TextField label="Temporary password" type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} required />
          <Select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value)}>{["user", "admin", ...(user?.app_metadata?.role === "superadmin" ? ["superadmin"] : [])].map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select>
          <Button type="submit" variant="contained">Create account</Button>
        </Stack>
      </Paper>
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, mt: 2 }}>
        <Paper component="form" onSubmit={createInvitation} sx={{ p: 3, flex: 1 }}><Typography variant="h6">Invite organization member</Typography><Stack spacing={2} sx={{ mt: 2 }}><TextField label="Email" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required /><Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{["user", "admin", ...(user?.app_metadata?.role === "superadmin" ? ["superadmin"] : [])].map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select><Button type="submit" variant="contained">Create invitation</Button></Stack></Paper>
        <Paper sx={{ p: 3, flex: 1 }}><Typography variant="h6" sx={{ mb: 2 }}>Audit trail</Typography>{audit.slice(0, 8).map((entry) => <Typography key={`${entry.timestamp}-${entry.action}`} variant="body2" sx={{ mb: 1 }}>{new Date(entry.timestamp).toLocaleString()} · {entry.actor} · {entry.action} · {entry.target}</Typography>)}{!audit.length && <Typography color="text.secondary">No changes recorded yet.</Typography>}</Paper>
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