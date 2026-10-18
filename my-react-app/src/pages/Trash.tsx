import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import api from "../services/api";

type TrashEntry = {
  trashEntryId: number;
  entityType: string;
  displayName: string;
  deletedAt: string;
};

export default function Trash() {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);

  async function loadTrash() {
    try {
      const response = await api.get<TrashEntry[]>("/Trash");
      setEntries(response.data);
      setError("");
    } catch {
      setError("Unable to load Trash. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTrash(); }, []);

  async function restore(entry: TrashEntry) {
    setRestoringId(entry.trashEntryId);
    try {
      await api.post(`/Trash/${entry.trashEntryId}/restore`);
      await loadTrash();
    } catch (restoreError: unknown) {
      const status = typeof restoreError === "object" && restoreError !== null && "response" in restoreError
        ? (restoreError.response as { status?: number } | undefined)?.status
        : undefined;
      setError(status === 410 ? "This item has passed the 30-day recovery period." : "Unable to restore this item.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Box>
      <Typography variant="h3" component="h1" sx={{ mb: 1 }}>Trash</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Deleted items can be restored for 30 days. Related records deleted with a project or task are restored together.</Typography>
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress /> : entries.length ? (
        <Stack spacing={1}>
          {entries.map((entry) => {
            const expires = new Date(new Date(entry.deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
            return (
              <Paper key={entry.trashEntryId} sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{entry.displayName}</Typography>
                    <Typography variant="body2" color="text.secondary">{entry.entityType} · Deleted {formatDate(entry.deletedAt)} · Expires {formatDate(expires.toISOString())}</Typography>
                  </Box>
                  <Button variant="outlined" onClick={() => void restore(entry)} disabled={restoringId === entry.trashEntryId}>
                    {restoringId === entry.trashEntryId ? "Restoring…" : "Restore"}
                  </Button>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : <Paper sx={{ p: 3 }}><Typography color="text.secondary">Trash is empty.</Typography></Paper>}
    </Box>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
