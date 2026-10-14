import { useState, type FormEvent } from "react";
import { Alert, Box, Button, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function InviteUser() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSending(true);
    try {
      await api.post("/admin/invitations", { email: email.trim(), role });
      navigate("/superadmin", {
        replace: true,
        state: { message: `Invitation sent to ${email.trim()}.` },
      });
    } catch (requestError) {
      setError(readApiError(requestError, "Unable to send the invitation."));
    } finally {
      setIsSending(false);
    }
  }

  const availableRoles = ["user", "admin", ...(user?.app_metadata?.role === "superadmin" ? ["superadmin"] : [])];

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <Typography variant="overline" color="primary">Administration</Typography>
      <Typography variant="h3" component="h1">Invite new user</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Send a secure invitation to a teammate and select their initial system role.
      </Typography>
      <Paper component="form" onSubmit={sendInvitation} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error" role="alert">{error}</Alert>}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
            autoFocus
          />
          <Box>
            <Typography component="label" htmlFor="invite-role" variant="body2" sx={{ display: "block", mb: 0.75 }}>
              Initial role
            </Typography>
            <Select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              fullWidth
            >
              {availableRoles.map((availableRole) => (
                <MenuItem key={availableRole} value={availableRole}>
                  {availableRole.charAt(0).toUpperCase() + availableRole.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Typography variant="body2" color="text.secondary">
            The invitee will receive an email to finish creating their account. They can provide their name when they accept the invitation.
          </Typography>
          <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.5} sx={{ justifyContent: "flex-end" }}>
            <Button component={Link} to="/superadmin" variant="outlined" disabled={isSending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSending || !email.trim()}>
              {isSending ? "Sending invitation..." : "Send invitation"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}

function readApiError(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = error.response;
  if (typeof response !== "object" || response === null || !("data" in response)) return fallback;
  const data = response.data;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    if ("detail" in data && typeof data.detail === "string") return data.detail;
    if ("title" in data && typeof data.title === "string") return data.title;
  }
  return fallback;
}
