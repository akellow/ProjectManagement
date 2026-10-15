import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import api from "../services/api";

type AuditEntry = {
  auditLogId: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  severity: string;
  statusCode: number | null;
  endpoint: string | null;
};
type Timeframe = "hour" | "day" | "week" | "month" | "custom";

const timeframes: { value: Timeframe; label: string; durationMs: number }[] = [
  { value: "hour", label: "Last hour", durationMs: 60 * 60 * 1000 },
  { value: "day", label: "Last 24 hours", durationMs: 24 * 60 * 60 * 1000 },
  { value: "week", label: "Last 7 days", durationMs: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "Last 30 days", durationMs: 30 * 24 * 60 * 60 * 1000 },
  { value: "custom", label: "Custom range", durationMs: 0 },
];

export default function SystemLogs() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [search, setSearch] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>("hour");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [severity, setSeverity] = useState("all");
  const [statusCode, setStatusCode] = useState("all");
  const [endpoint, setEndpoint] = useState("all");

  const loadEntries = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    setError("");
    try {
      const params: Record<string, string | number> = {};
      const selectedTimeframe = timeframes.find((item) => item.value === timeframe);
      if (timeframe === "custom") {
        if (customFrom) params.from = new Date(customFrom).toISOString();
        if (customTo) params.to = new Date(customTo).toISOString();
      } else if (selectedTimeframe) {
        params.from = new Date(Date.now() - selectedTimeframe.durationMs).toISOString();
      }
      if (search.trim()) params.search = search.trim();
      if (severity !== "all") params.severity = severity;
      if (statusCode !== "all") params.statusCode = Number(statusCode);
      if (endpoint !== "all") params.endpoint = endpoint;

      const response = await api.get<AuditEntry[]>("/admin/audit", { params });
      setEntries(response.data);
    } catch (loadError: unknown) {
      setError(readApiError(loadError, "Unable to load system logs."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [customFrom, customTo, endpoint, search, severity, statusCode, timeframe]);

  useEffect(() => {
    const debounce = window.setTimeout(() => void loadEntries(), 250);
    return () => window.clearTimeout(debounce);
  }, [loadEntries]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void loadEntries(), 15_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadEntries]);

  const endpointOptions = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.endpoint).filter((value): value is string => Boolean(value)))).sort(),
    [entries],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set([
      200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504,
      ...entries.map((entry) => entry.statusCode).filter((value): value is number => value !== null),
    ])).sort((a, b) => a - b),
    [entries],
  );
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, AuditEntry[]>();
    for (const entry of entries) {
      const date = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(entry.timestamp));
      const group = groups.get(date) ?? [];
      group.push(entry);
      groups.set(date, group);
    }
    return Array.from(groups.entries());
  }, [entries]);

  const chartBuckets = useMemo(() => {
    if (!entries.length) return [];
    const selectedDuration = timeframe === "custom" && customFrom && customTo
      ? new Date(customTo).getTime() - new Date(customFrom).getTime()
      : timeframes.find((item) => item.value === timeframe)?.durationMs ?? 24 * 60 * 60 * 1000;
    const useHourlyBuckets = timeframe === "hour" || (timeframe === "custom" && selectedDuration <= 24 * 60 * 60 * 1000);
    const bucketSize = useHourlyBuckets ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const buckets = new Map<number, { info: number; warning: number; error: number }>();
    for (const entry of entries) {
      const timestamp = new Date(entry.timestamp).getTime();
      const start = Math.floor(timestamp / bucketSize) * bucketSize;
      const bucket = buckets.get(start) ?? { info: 0, warning: 0, error: 0 };
      const level = entry.severity.toLowerCase();
      if (level === "error") bucket.error++;
      else if (level === "warning") bucket.warning++;
      else bucket.info++;
      buckets.set(start, bucket);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a - b).map(([start, counts]) => ({
      start,
      ...counts,
      total: counts.info + counts.warning + counts.error,
    }));
  }, [customFrom, customTo, entries, timeframe]);

  const maxBucketCount = Math.max(1, ...chartBuckets.map((bucket) => bucket.total));
  const customRangeInvalid = Boolean(customFrom && customTo && new Date(customFrom) > new Date(customTo));

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Typography variant="overline" color="primary">Administration</Typography>
      <Typography variant="h3" component="h1">System logs</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Search and review stored administrative and API activity. New events are checked automatically every 15 seconds.
      </Typography>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={1} sx={{ mb: 2, alignItems: { lg: "center" } }}>
        <TextField
          size="small"
          placeholder="Search events"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{ htmlInput: { "aria-label": "Search events" } }}
          sx={{ flex: 1, minWidth: 180 }}
        />
        <Button onClick={() => void loadEntries(true)} disabled={isRefreshing} aria-label="Refresh logs">
          {isRefreshing ? <CircularProgress size={20} /> : "Refresh"}
        </Button>
        <FormControl size="small" sx={{ minWidth: 145 }}>
          <InputLabel id="log-timeframe-label">Timeframe</InputLabel>
          <Select labelId="log-timeframe-label" value={timeframe} label="Timeframe" onChange={(event) => setTimeframe(event.target.value as Timeframe)}>
            {timeframes.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="log-severity-label">Severity</InputLabel>
          <Select labelId="log-severity-label" value={severity} label="Severity" onChange={(event) => setSeverity(event.target.value)}>
            <MenuItem value="all">All severity</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 125 }}>
          <InputLabel id="log-status-label">Status code</InputLabel>
          <Select labelId="log-status-label" value={statusCode} label="Status code" onChange={(event) => setStatusCode(event.target.value)}>
            <MenuItem value="all">All statuses</MenuItem>
            {statusOptions.map((code) => <MenuItem key={code} value={String(code)}>{code}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150, maxWidth: 250 }}>
          <InputLabel id="log-endpoint-label">Endpoint</InputLabel>
          <Select labelId="log-endpoint-label" value={endpoint} label="Endpoint" onChange={(event) => setEndpoint(event.target.value)}>
            <MenuItem value="all">All endpoints</MenuItem>
            {endpointOptions.map((path) => <MenuItem key={path} value={path}>{path}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <Button size="small" variant={showChart ? "contained" : "outlined"} onClick={() => setShowChart((current) => !current)}>
          {showChart ? "Hide chart" : "Show chart"}
        </Button>
        <Button size="small" variant={autoRefresh ? "contained" : "outlined"} onClick={() => setAutoRefresh((current) => !current)}>
          Auto-refresh {autoRefresh ? "on" : "off"}
        </Button>
      </Stack>

      {timeframe === "custom" && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="From"
            type="datetime-local"
            size="small"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="datetime-local"
            size="small"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {customRangeInvalid && <Alert severity="error">The start of the range must be before its end.</Alert>}
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {showChart && (
        <Paper component="section" aria-label="Activity chart" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 2 }}>
            <Typography variant="h6">Activity</Typography>
            <Typography variant="body2" color="text.secondary">{entries.length} events</Typography>
          </Stack>
          {chartBuckets.length ? (
            <Box sx={{ display: "flex", height: 130, alignItems: "end", gap: { xs: 0.5, sm: 1 }, borderBottom: "1px solid", borderColor: "divider", px: 0.5 }}>
              {chartBuckets.map((bucket) => {
                const title = `${formatBucket(bucket.start, timeframe)} · ${bucket.total} events (info ${bucket.info}, warning ${bucket.warning}, error ${bucket.error})`;
                const height = Math.max(4, bucket.total / maxBucketCount * 100);
                return (
                  <Tooltip key={bucket.start} title={title} arrow>
                    <Box
                      aria-label={title}
                      sx={{
                        display: "flex",
                        width: "100%",
                        maxWidth: 42,
                        height: `${height}%`,
                        minHeight: 4,
                        alignItems: "end",
                        cursor: "help",
                      }}
                    >
                      {bucket.info > 0 && <Box sx={{ width: `${bucket.info / bucket.total * 100}%`, height: "100%", bgcolor: "#38c98d" }} />}
                      {bucket.warning > 0 && <Box sx={{ width: `${bucket.warning / bucket.total * 100}%`, height: "100%", bgcolor: "#f5a623" }} />}
                      {bucket.error > 0 && <Box sx={{ width: `${bucket.error / bucket.total * 100}%`, height: "100%", bgcolor: "#ef514b" }} />}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ) : (
            <Typography color="text.secondary">No activity in this timeframe.</Typography>
          )}
          <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
            <Legend color="#38c98d" label="Info" />
            <Legend color="#f5a623" label="Warning" />
            <Legend color="#ef514b" label="Error" />
          </Stack>
        </Paper>
      )}

      {isLoading ? <CircularProgress aria-label="Loading system logs" /> : entries.length ? (
        <Stack spacing={2}>
          {groupedEntries.map(([date, dayEntries]) => (
            <Box component="section" key={date} aria-label={date}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>{date}</Typography>
              <Paper sx={{ overflow: "hidden" }}>
                {dayEntries.map((entry) => (
                  <LogRow key={entry.auditLogId} entry={entry} />
                ))}
              </Paper>
            </Box>
          ))}
          {entries.length === 2000 && (
            <Typography variant="body2" color="text.secondary">Showing the newest 2,000 matching events. Narrow the timeframe or search to see older results.</Typography>
          )}
        </Stack>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">No events match the selected filters.</Typography>
        </Paper>
      )}

      <Button component={Link} to="/superadmin" variant="outlined" sx={{ mt: 3 }}>Back to dashboard</Button>
    </Box>
  );
}

function LogRow({ entry }: { entry: AuditEntry }) {
  const timestamp = new Date(entry.timestamp);
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(timestamp);
  const severity = entry.severity.toLowerCase();
  const color = severity === "error" ? "#ef514b" : severity === "warning" ? "#f5a623" : "#27a4ff";
  const endpoint = entry.endpoint ?? entry.target;
  const description = entry.statusCode
    ? `${endpoint}  |  ${entry.action}  |  ${entry.statusCode}`
    : `${entry.action}  |  ${entry.target}`;
  const hoverDetails = (
    <Stack spacing={0.5} sx={{ minWidth: 250, p: 0.5 }}>
      <TooltipDetail label="UTC" value={timestamp.toLocaleString("en-GB", { timeZone: "UTC" })} />
      <TooltipDetail label="Africa/Nairobi" value={timestamp.toLocaleString("en-GB", { timeZone: "Africa/Nairobi" })} />
      <TooltipDetail label="Relative" value={relativeTime(timestamp)} />
      <TooltipDetail label="Timestamp" value={String(timestamp.getTime())} />
      <TooltipDetail label="Actor" value={entry.actor} />
    </Stack>
  );

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.5, sm: 2 }}
      sx={{
        px: 2,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        alignItems: { sm: "center" },
        "&:last-child": { borderBottom: 0 },
      }}
    >
      <Tooltip title={hoverDetails} arrow placement="top">
        <Typography
          component="time"
          dateTime={timestamp.toISOString()}
          sx={{ width: { sm: 160 }, flex: "0 0 auto", fontFamily: "var(--mono)", fontSize: 13, cursor: "help" }}
        >
          {localTime}
        </Typography>
      </Tooltip>
      <Typography sx={{ width: { sm: 88 }, flex: "0 0 auto", color, fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>
        ◉ {severity}
      </Typography>
      <Typography sx={{ width: { sm: 52 }, flex: "0 0 auto", color: entry.statusCode && entry.statusCode >= 400 ? "#ef514b" : "text.secondary", fontFamily: "var(--mono)", fontSize: 13 }}>
        {entry.statusCode ?? "—"}
      </Typography>
      <Typography sx={{ minWidth: 0, overflowWrap: "anywhere", fontFamily: "var(--mono)", fontSize: 13 }}>
        <Box component="span" sx={{ color: "primary.main" }}>{endpoint}</Box>
        {"  |  "}{description}
      </Typography>
    </Stack>
  );
}

function TooltipDetail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{label}</Typography>
      <Typography variant="caption" sx={{ textAlign: "right" }}>{value}</Typography>
    </Stack>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

function formatBucket(timestamp: number, timeframe: Timeframe) {
  return new Intl.DateTimeFormat("en-GB", timeframe === "hour" || timeframe === "custom"
    ? { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }
    : { timeZone: "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric" },
  ).format(new Date(timestamp));
}

function relativeTime(timestamp: Date) {
  const seconds = Math.round((timestamp.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function readApiError(error: unknown, fallback: string) {
  if (typeof error !== "object" || error === null || !("response" in error)) return fallback;
  const response = error.response;
  if (typeof response !== "object" || response === null || !("data" in response)) return fallback;
  const data = response.data;
  if (typeof data === "object" && data !== null) {
    if ("detail" in data && typeof data.detail === "string") return data.detail;
    if ("title" in data && typeof data.title === "string") return data.title;
  }
  return fallback;
}
