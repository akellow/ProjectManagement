import { useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Divider, IconButton, Menu, MenuItem, Popover, Snackbar, Stack, Tooltip, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import api from "../services/api";

type Notification = { notificationId: number; senderName: string; message: string; createdAt: string; isRead: boolean };

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { preferences, saveSettings } = useSettings();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [topbarError, setTopbarError] = useState("");

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await api.get<Notification[]>("/notifications");
        if (active) {
          setNotifications(response.data);
          setTopbarError("");
        }
      } catch (error) {
        if (active) setTopbarError(error instanceof Error ? error.message : "Unable to refresh notifications.");
      }
    };

    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  async function markRead(notification: Notification) {
    try {
      await api.put(`/notifications/${notification.notificationId}/read`);
      setNotifications((current) => current.map((item) =>
        item.notificationId === notification.notificationId ? { ...item, isRead: true } : item));
    } catch (error) {
      setTopbarError(error instanceof Error ? error.message : "Unable to mark the notification as read.");
    }
  }

  async function toggleTheme() {
    const theme = preferences.theme === "dark" ? "light" : "dark";
    try {
      await saveSettings(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "", {
        ...preferences,
        theme,
      });
    } catch (error) {
      setTopbarError(error instanceof Error ? error.message : "Unable to save the theme preference.");
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const displayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email
    ?? "Account";
  const initials = displayName.trim().charAt(0).toUpperCase() || "A";

  return (
    <Box className="app-layout">
      <Navbar />
      <Box component="main" className="page-content">
        <Box component="header" className="workspace-topbar">
          <Typography className="workspace-label" color="text.secondary">My Workspace</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Tooltip title="Notifications">
              <IconButton
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                onClick={(event) => setNotificationAnchor(event.currentTarget)}
                color="inherit"
              >
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <BellIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Account menu">
              <IconButton
                aria-label="Open account menu"
                onClick={(event) => setProfileAnchor(event.currentTarget)}
                className="profile-trigger"
              >
                <span className="profile-avatar">{initials}</span>
                <span className="profile-name">{displayName}</span>
                <ChevronIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <Popover
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          hideBackdrop
          disableScrollLock
          onClose={() => setNotificationAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { className: "notification-popover" } }}
        >
          <Box className="notification-popover-header">
            <Typography sx={{ fontWeight: 700 }}>Notifications</Typography>
            <IconButton aria-label="Close notifications" size="small" onClick={() => setNotificationAnchor(null)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box className="notification-popover-list" aria-live="polite" aria-relevant="additions text">
            {notifications.slice(0, 8).map((notification) => (
              <Box
                component="button"
                type="button"
                key={notification.notificationId}
                className={`notification-popover-item${notification.isRead ? "" : " is-unread"}`}
                onClick={() => { if (!notification.isRead) void markRead(notification); }}
              >
                <Typography component="span" className="notification-sender">
                  {notification.senderName || "Project team"}
                </Typography>
                <Typography component="span" className="notification-message">
                  {notification.message}
                </Typography>
                <Typography component="time" dateTime={notification.createdAt} className="notification-time">
                  {formatNotificationTime(notification.createdAt)}
                </Typography>
              </Box>
            ))}
            {!notifications.length && (
              <Typography className="topbar-empty">You’re all caught up.</Typography>
            )}
          </Box>
          <Divider />
          <Box className="notification-popover-footer">
            <Button
              component={Link}
              to="/notifications"
              className="notification-popover-link"
              onClick={() => setNotificationAnchor(null)}
            >
              View all notifications
            </Button>
          </Box>
        </Popover>
        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={() => setProfileAnchor(null)}
          slotProps={{ paper: { className: "topbar-menu profile-menu" } }}
        >
          <Box className="profile-menu-identity">
            <span className="profile-avatar">{initials}</span>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>{displayName}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{user?.email}</Typography>
            </Box>
          </Box>
          <Divider />
          <MenuItem component={Link} to="/settings" onClick={() => setProfileAnchor(null)}>
            <SettingsIcon />
            Account settings
          </MenuItem>
          <MenuItem onClick={() => { setProfileAnchor(null); void toggleTheme(); }}>
            <ThemeIcon />
            Switch to {preferences.theme === "dark" ? "light" : "dark"} theme
          </MenuItem>
          <MenuItem component={Link} to="/notifications" onClick={() => setProfileAnchor(null)}>
            <BellIcon />
            Notifications
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { setProfileAnchor(null); void signOut(); }}>
            <SignOutIcon />
            Sign out
          </MenuItem>
        </Menu>
        <Snackbar
          open={Boolean(topbarError)}
          autoHideDuration={6000}
          onClose={() => setTopbarError("")}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert severity="error" onClose={() => setTopbarError("")}>{topbarError}</Alert>
        </Snackbar>
        {children}
      </Box>
    </Box>
  );
}

function BellIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m18 6-12 12M6 6l12 12" /></svg>;
}

function formatNotificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function ChevronIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5-5 5 5M7 14l5 5 5-5" /></svg>;
}

function SettingsIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" /></svg>;
}

function ThemeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 3v18a9 9 0 0 0 0-18Z" /></svg>;
}

function SignOutIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>;
}
