import { useCallback, useEffect, useState } from "react";
import { Alert, Box, CircularProgress, IconButton, Paper, Stack, Typography } from "@mui/material";
import api from "../services/api";

type Notification = {
  notificationId: number;
  senderName: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get<Notification[]>("/notifications");
      setNotifications(response.data);
      setError("");
    } catch (loadError: unknown) {
      setError(readApiError(loadError, "Unable to load notifications."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function markRead(notification: Notification) {
    try {
      await api.put(`/notifications/${notification.notificationId}/read`);
      setNotifications((current) => current.map((item) =>
        item.notificationId === notification.notificationId ? { ...item, isRead: true } : item));
    } catch (readError: unknown) {
      setError(readApiError(readError, "Unable to mark the notification as read."));
    }
  }

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <Typography variant="overline" color="primary">Inbox</Typography>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>Notifications</Typography>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      <Paper aria-live="polite" aria-relevant="additions text" sx={{ overflow: "hidden" }}>
        {isLoading ? (
          <Stack sx={{ minHeight: 120, alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={24} aria-label="Loading notifications" />
          </Stack>
        ) : notifications.length ? (
          notifications.map((notification) => (
            <Stack
              key={notification.notificationId}
              direction="row"
              spacing={1}
              sx={{
                alignItems: "flex-start",
                px: 1.5,
                py: 1.25,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: notification.isRead ? "transparent" : "action.hover",
                "&:last-child": { borderBottom: 0 },
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                  {notification.senderName || "Project team"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.35, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                  {notification.message}
                </Typography>
                <Typography component="time" dateTime={notification.createdAt} variant="caption" color="text.secondary">
                  {new Date(notification.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Typography>
              </Box>
              {!notification.isRead && (
                <IconButton
                  size="small"
                  aria-label={`Mark notification from ${notification.senderName || "Project team"} as read`}
                  title="Mark as read"
                  onClick={() => void markRead(notification)}
                  sx={{ mt: -0.5 }}
                >
                  <span className="notification-unread-dot" />
                </IconButton>
              )}
            </Stack>
          ))
        ) : (
          <Typography color="text.secondary" sx={{ p: 2 }}>You’re all caught up.</Typography>
        )}
      </Paper>
    </Box>
  );
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
