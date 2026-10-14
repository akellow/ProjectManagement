import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import api from "../services/api";

type SystemUser = {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  source: "identity" | "supabase";
};

export default function SystemUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState("");

  async function loadUsers() {
    setError("");
    try {
      const response = await api.get<SystemUser[]>("/admin/users");
      setUsers(response.data);
    } catch (loadError) {
      setError(readApiError(loadError, "Unable to load system users."));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function changeRole(user: SystemUser, role: string) {
    setBusyUserId(user.id);
    setError("");
    setMessage("");
    try {
      await api.put(`/admin/users/${user.id}/role`, { role });
      await loadUsers();
      setMessage(`Role updated for ${user.userName}. The user may need to sign in again for permissions to refresh.`);
    } catch (roleError) {
      setError(readApiError(roleError, "Unable to update this user's role."));
    } finally {
      setBusyUserId("");
    }
  }

  async function deleteUser(user: SystemUser) {
    if (user.roles.some((role) => role.toLowerCase() === "superadmin")) return;
    if (!window.confirm(`Delete ${user.userName}'s account? This cannot be undone.`)) return;
    setBusyUserId(user.id);
    setError("");
    setMessage("");
    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setMessage(`Deleted ${user.userName}.`);
    } catch (deleteError) {
      setError(readApiError(deleteError, "Unable to delete this user."));
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Typography variant="overline" color="primary">Administration</Typography>
      <Typography variant="h3" component="h1">System users</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Review registered accounts and manage their system roles.
      </Typography>
      <Button component={Link} to="/superadmin" sx={{ mb: 2 }}>Back to superadmin dashboard</Button>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {isLoading ? <CircularProgress /> : (
        <Stack spacing={1.5}>
          {users.map((systemUser) => {
            const currentRole = systemUser.roles[0] ?? "user";
            const isSuperadmin = systemUser.roles.some((role) => role.toLowerCase() === "superadmin");
            return (
              <Paper key={`${systemUser.source}-${systemUser.id}`} sx={{ p: 2.5 }}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">{systemUser.userName}</Typography>
                    <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {systemUser.email || "No email"} · {systemUser.source === "supabase" ? "Supabase Auth" : "API Identity"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Current role: {systemUser.roles.join(", ") || "user"}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Select
                      size="small"
                      value={currentRole}
                      aria-label={`Role for ${systemUser.userName}`}
                      disabled={busyUserId === systemUser.id}
                      onChange={(event) => void changeRole(systemUser, event.target.value)}
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="superadmin">Superadmin</MenuItem>
                    </Select>
                    {!isSuperadmin && (
                      <Button
                        size="small"
                        color="error"
                        disabled={busyUserId === systemUser.id}
                        onClick={() => void deleteUser(systemUser)}
                      >
                        Delete
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
          {!users.length && <Typography color="text.secondary">No system users found.</Typography>}
        </Stack>
      )}
    </Box>
  );
}

function readApiError(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null) return fallback;
  const response = "response" in error ? error.response : null;
  if (typeof response !== "object" || response === null || !("data" in response)) return fallback;
  const data = response.data;
  if (Array.isArray(data)) return data[0]?.description || fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    if ("detail" in data && typeof data.detail === "string") return data.detail;
    if ("title" in data && typeof data.title === "string") return data.title;
  }
  return fallback;
}
