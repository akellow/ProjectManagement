import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import type { DateFormat, ThemeMode, UserPreferences, WeekStart } from "../context/SettingsContext";
import api from "../services/api";
import { supabase } from "../services/supabaseClient";

type Notification = { notificationId: number; message: string; createdAt: string; isRead: boolean };

type SettingsGroupProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  return (
    <Paper component="section" sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" component="h2">{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>{description}</Typography>
      {children}
    </Paper>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { preferences, saveSettings } = useSettings();
  const [displayName, setDisplayName] = useState("");
  const [draftPreferences, setDraftPreferences] = useState<UserPreferences>(preferences);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [themeMessage, setThemeMessage] = useState("");
  const [themeError, setThemeError] = useState("");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsError, setNotificationsError] = useState("");
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  useEffect(() => {
    setDraftPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    setDisplayName(
      user?.user_metadata?.full_name
      ?? user?.user_metadata?.name
      ?? "",
    );
    setNewEmail(user?.email ?? "");
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.name]);

  useEffect(() => {
    let active = true;
    api.get<Notification[]>("/notifications")
      .then((response) => {
        if (active) setNotifications(response.data);
      })
      .catch((error: unknown) => {
        if (active) setNotificationsError(readApiError(error, "Unable to load notifications."));
      })
      .finally(() => {
        if (active) setIsLoadingNotifications(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const identities: { provider: string }[] = user?.identities ?? [];
  const providers = identities.length
    ? Array.from(new Set<string>(identities.map((identity) => identity.provider)))
    : ["email"];
  const notificationDateLocale = draftPreferences.dateFormat === "mdy"
    ? "en-US"
    : draftPreferences.dateFormat === "dmy"
      ? "en-GB"
      : draftPreferences.dateFormat === "ymd"
        ? "sv-SE"
        : undefined;

  function updatePreference<Key extends keyof UserPreferences>(key: Key, value: UserPreferences[Key]) {
    setDraftPreferences((current) => ({ ...current, [key]: value }));
  }

  async function updateTheme(theme: ThemeMode) {
    const nextPreferences = { ...draftPreferences, theme };
    setIsSavingTheme(true);
    setThemeError("");
    setThemeMessage("");
    try {
      await saveSettings(displayName, nextPreferences);
      setDraftPreferences(nextPreferences);
      setThemeMessage("Theme preference saved.");
    } catch (error: unknown) {
      setThemeError(error instanceof Error ? error.message : "Unable to save the theme preference.");
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function savePersonalSettings(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      await saveSettings(displayName, draftPreferences);
      setSettingsMessage("Your preferences have been saved to your profile.");
    } catch (error: unknown) {
      setSettingsError(error instanceof Error ? error.message : "Unable to save your settings.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function updateNotifications(enabled: boolean) {
    setSettingsError("");
    setSettingsMessage("");
    try {
      await api.put("/account/notifications", { enabled });
      const nextPreferences = { ...draftPreferences, notificationsEnabled: enabled };
      setDraftPreferences(nextPreferences);
      await saveSettings(displayName, nextPreferences);
      setSettingsMessage("Notification preference saved.");
    } catch (error: unknown) {
      setSettingsError(error instanceof Error ? error.message : "Unable to update notification settings.");
    }
  }

  async function markNotificationRead(notificationId: number) {
    setNotificationsError("");
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications((current) => current.map((notification) =>
        notification.notificationId === notificationId
          ? { ...notification, isRead: true }
          : notification));
    } catch (error: unknown) {
      setNotificationsError(readApiError(error, "Unable to update notification."));
    }
  }

  async function updateEmail(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingSecurity(true);
    setSecurityError("");
    setSecurityMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      setSecurityMessage("Check your email for a confirmation link to finish changing your address.");
    } catch (error: unknown) {
      setSecurityError(error instanceof Error ? error.message : "Unable to request an email change.");
    } finally {
      setIsSavingSecurity(false);
    }
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingSecurity(true);
    setSecurityError("");
    setSecurityMessage("");
    try {
      if (newPassword.length < 8) throw new Error("Your password must contain at least 8 characters.");
      if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setSecurityMessage("Your password has been updated.");
    } catch (error: unknown) {
      setSecurityError(error instanceof Error ? error.message : "Unable to update your password.");
    } finally {
      setIsSavingSecurity(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Typography variant="overline" color="primary">Preferences</Typography>
      <Typography variant="h3" component="h1">Settings</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage your appearance, personal preferences, notifications, and sign-in security.
      </Typography>

      <Stack spacing={2}>
        <SettingsGroup title="Theme" description="Choose how Project Management looks on this device.">
          <FormControl fullWidth>
            <InputLabel id="theme-mode-label">Appearance</InputLabel>
            <Select
              labelId="theme-mode-label"
              label="Appearance"
              value={draftPreferences.theme}
              onChange={(event) => void updateTheme(event.target.value as ThemeMode)}
              disabled={isSavingTheme}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">Use device setting</MenuItem>
            </Select>
          </FormControl>
          {themeError && <Alert severity="error" sx={{ mt: 2 }}>{themeError}</Alert>}
          {themeMessage && <Alert severity="success" sx={{ mt: 2 }}>{themeMessage}</Alert>}
        </SettingsGroup>

        <SettingsGroup title="Personal preferences" description="Set your profile name and regional defaults.">
          <Stack spacing={2} component="form" onSubmit={savePersonalSettings}>
            <TextField
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <FormControl fullWidth>
              <InputLabel id="time-zone-label">Time zone</InputLabel>
              <Select
                labelId="time-zone-label"
                label="Time zone"
                value={draftPreferences.timeZone}
                onChange={(event) => updatePreference("timeZone", event.target.value)}
              >
                {Intl.supportedValuesOf("timeZone").map((timeZone) => (
                  <MenuItem key={timeZone} value={timeZone}>{timeZone}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="date-format-label">Date format</InputLabel>
              <Select
                labelId="date-format-label"
                label="Date format"
                value={draftPreferences.dateFormat}
                onChange={(event) => updatePreference("dateFormat", event.target.value as DateFormat)}
              >
                <MenuItem value="locale">Use device locale</MenuItem>
                <MenuItem value="mdy">Month / day / year</MenuItem>
                <MenuItem value="dmy">Day / month / year</MenuItem>
                <MenuItem value="ymd">Year / month / day</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="week-start-label">Week starts on</InputLabel>
              <Select
                labelId="week-start-label"
                label="Week starts on"
                value={draftPreferences.weekStartsOn}
                onChange={(event) => updatePreference("weekStartsOn", event.target.value as WeekStart)}
              >
                <MenuItem value="monday">Monday</MenuItem>
                <MenuItem value="sunday">Sunday</MenuItem>
              </Select>
            </FormControl>
            {settingsError && <Alert severity="error">{settingsError}</Alert>}
            {settingsMessage && <Alert severity="success">{settingsMessage}</Alert>}
            <Button type="submit" variant="contained" disabled={isSavingSettings}>
              {isSavingSettings ? "Saving..." : "Save personal preferences"}
            </Button>
          </Stack>
        </SettingsGroup>

        <SettingsGroup title="Notifications" description="Choose whether you receive in-app notifications and review recent activity.">
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={draftPreferences.notificationsEnabled}
                  onChange={(event) => void updateNotifications(event.target.checked)}
                  disabled={isSavingSettings}
                />
              }
              label={draftPreferences.notificationsEnabled ? "In-app notifications enabled" : "In-app notifications disabled"}
            />
            <Divider />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recent notifications</Typography>
            {notificationsError && <Alert severity="error">{notificationsError}</Alert>}
            {isLoadingNotifications ? <Typography color="text.secondary">Loading notifications...</Typography> : (
              <Stack spacing={1}>
                {notifications.map((notification) => (
                  <Stack
                    key={notification.notificationId}
                    direction={{ xs: "column", sm: "row" }}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                      gap: 1,
                      p: 1.5,
                      bgcolor: notification.isRead ? "transparent" : "action.hover",
                      borderRadius: 1,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: notification.isRead ? "normal" : 700 }}>
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notification.createdAt).toLocaleString(notificationDateLocale, {
                          timeZone: draftPreferences.timeZone,
                          year: "numeric",
                          month: draftPreferences.dateFormat === "locale" ? "long" : "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Typography>
                    </Box>
                    {!notification.isRead && (
                      <Button size="small" onClick={() => void markNotificationRead(notification.notificationId)}>
                        Mark read
                      </Button>
                    )}
                  </Stack>
                ))}
                {!notifications.length && <Typography color="text.secondary">No notifications yet.</Typography>}
              </Stack>
            )}
          </Stack>
        </SettingsGroup>

        <SettingsGroup title="Security" description="Manage the email and sign-in methods associated with your account.">
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Connected sign-in methods</Typography>
              <Stack direction="row" spacing={1}>
                {providers.map((provider: string) => (
                  <Chip key={provider} label={provider === "google" ? "Google" : provider} />
                ))}
              </Stack>
            </Box>
            <Divider />
            {securityError && <Alert severity="error">{securityError}</Alert>}
            {securityMessage && <Alert severity="success">{securityMessage}</Alert>}
            <Stack spacing={2} component="form" onSubmit={updateEmail}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Email address</Typography>
              <TextField label="Email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
              <Button type="submit" variant="outlined" disabled={isSavingSecurity || newEmail.trim() === user?.email}>
                {isSavingSecurity ? "Please wait..." : "Update email"}
              </Button>
            </Stack>
            <Divider />
            <Stack spacing={2} component="form" onSubmit={updatePassword}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Change password</Typography>
              <TextField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <TextField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <Button type="submit" variant="outlined" disabled={isSavingSecurity}>
                {isSavingSecurity ? "Please wait..." : "Update password"}
              </Button>
            </Stack>
          </Stack>
        </SettingsGroup>
      </Stack>
    </Box>
  );
}

function readApiError(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response;
    if (typeof response === "object" && response !== null && "data" in response) {
      const data = response.data;
      if (typeof data === "string") return data;
      if (typeof data === "object" && data !== null && "detail" in data && typeof data.detail === "string") {
        return data.detail;
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}
