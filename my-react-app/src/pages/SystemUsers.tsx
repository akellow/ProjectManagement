import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useConfirmAction } from "../components/useConfirmAction";

type SystemUser = {
  id: string;
  userName: string;
  email: string;
  roles: string[];
  source: "identity" | "supabase";
};

export default function SystemUsers() {
  const { confirmAction, confirmationDialog } = useConfirmAction();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [search, setSearch] = useState("");

  async function loadUsers(showSpinner = false) {
    if (showSpinner) setIsLoading(true);
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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((systemUser) => !query || [
      systemUser.userName,
      systemUser.email,
      systemUser.source,
      ...systemUser.roles,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [search, users]);

  const groupedUsers = useMemo(() => {
    const groups = new Map<string, SystemUser[]>();
    for (const systemUser of filteredUsers) {
      const groupName = systemUser.source === "supabase" ? "Supabase Auth" : "API Identity";
      const group = groups.get(groupName) ?? [];
      group.push(systemUser);
      groups.set(groupName, group);
    }
    return Array.from(groups.entries());
  }, [filteredUsers]);

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
    if (!await confirmAction(`Permanently delete ${user.userName}'s account? Account deletion is not recoverable from Trash.`, "Delete permanently")) return;
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
      {confirmationDialog}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search users"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ htmlInput: { "aria-label": "Search system users" } }}
          sx={{ flex: 1, minWidth: 180 }}
        />
        <Button onClick={() => void loadUsers(true)} disabled={isLoading}>
          {isLoading ? <CircularProgress size={20} /> : "Refresh"}
        </Button>
      </Stack>
      {isLoading ? <CircularProgress /> : (
        <Stack spacing={2}>
          {groupedUsers.map(([source, sourceUsers]) => (
            <Box component="section" key={source} aria-label={source}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>{source}</Typography>
              <Paper sx={{ overflow: "hidden" }}>
                {sourceUsers.map((systemUser) => {
            const currentRole = systemUser.roles[0] ?? "user";
            const isSuperadmin = systemUser.roles.some((role) => role.toLowerCase() === "superadmin");
            return (
              <Stack
                key={`${systemUser.source}-${systemUser.id}`}
                direction={{ xs: "column", md: "row" }}
                spacing={{ xs: 1, md: 2 }}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { md: "center" },
                  px: 2,
                  py: 1.25,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{systemUser.userName}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {systemUser.email || "No email"}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100 }}>
                    {systemUser.roles.join(", ") || "user"}
                  </Typography>
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
            );
                })}
              </Paper>
            </Box>
          ))}
          {!filteredUsers.length && (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">
                {users.length ? "No users match the search." : "No system users found."}
              </Typography>
            </Paper>
          )}
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
