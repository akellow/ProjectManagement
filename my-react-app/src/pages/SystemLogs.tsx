import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import api from "../services/api";

type AuditEntry = { timestamp: string; actor: string; action: string; target: string };

export default function SystemLogs() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const response = await api.get<AuditEntry[]>("/admin/audit");
      setEntries(response.data);
    } catch (loadError: unknown) {
      setError(readApiError(loadError, "Unable to load system logs."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="overline" color="primary">Administration</Typography>
      <Typography variant="h3" component="h1">System logs</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Administrative activity recorded by the application. These are audit events, not diagnostic server logs.
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2, gap: 1 }}>
        <Button component={Link} to="/superadmin" variant="outlined">Back to dashboard</Button>
        <Button onClick={() => void loadEntries()} disabled={isLoading}>Refresh logs</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {isLoading ? <CircularProgress aria-label="Loading system logs" /> : entries.length ? (
        <Stack spacing={1}>
          {entries.map((entry, index) => (
            <Paper key={`${entry.timestamp}-${entry.action}-${index}`} sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{entry.action}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.actor} · {entry.target}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {new Date(entry.timestamp).toLocaleString()}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No administrative activity has been recorded yet.</Typography>
        </Paper>
      )}
    </Box>
  );
}

function readApiError(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response;
    if (typeof response === "object" && response !== null && "data" in response) {
      const data = response.data;
      if (typeof data === "object" && data !== null && "detail" in data && typeof data.detail === "string") {
        return data.detail;
      }
    }
  }
  return fallback;
}
