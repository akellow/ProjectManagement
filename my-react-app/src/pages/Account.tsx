import { useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import api from "../services/api";

type AccountData = { userName: string; email: string; emailConfirmed: boolean; notificationsEnabled: boolean };
type Notification = { notificationId: number; message: string; createdAt: string; isRead: boolean };

export default function Account() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    api.get<AccountData>("/account").then((response) => {
      setAccount(response.data);
      setEmail(response.data.email);
      setNotificationsEnabled(response.data.notificationsEnabled);
    }).catch((error) => setMessage(readApiError(error, "Unable to load account details.")));

    api.get<Notification[]>("/notifications").then((response) => {
      setNotifications(response.data);
    }).catch((error) => setMessage(readApiError(error, "Notifications are unavailable. Apply the notifications database migration.")));
  }, []);

  async function requestVerification(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    try {
      const response = await api.post<{ requiresVerification?: boolean }>("/account/email/request", { email, currentPassword });
      if (response.data.requiresVerification === false) {
        setAccount({ ...account!, email, emailConfirmed: true });
        setCurrentPassword("");
        setMessage("Email address updated successfully.");
      } else {
        setVerificationSent(true);
        setMessage("A verification code was sent to the new email address.");
      }
    } catch (error: any) {
      setMessage(readApiError(error, "Unable to send verification code."));
    } finally { setIsSaving(false); }
  }

  async function updateNotificationSetting(enabled: boolean) {
    try {
      await api.put("/account/notifications", { enabled });
      setNotificationsEnabled(enabled);
    } catch (error: any) {
      setMessage(readApiError(error, "Unable to update notification settings."));
    }
  }

  async function markNotificationRead(notificationId: number) {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map((item) => item.notificationId === notificationId ? { ...item, isRead: true } : item));
    } catch (error: any) {
      setMessage(readApiError(error, "Unable to update notification."));
    }
  }

  async function confirmEmail(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);
    try {
      const response = await api.post<AccountData>("/account/email/confirm", { email, code });
      setAccount(response.data);
      setCurrentPassword(""); setCode(""); setVerificationSent(false);
      setMessage("Email address updated successfully.");
    } catch (error: any) {
      setMessage(readApiError(error, "Unable to verify email address."));
    } finally { setIsSaving(false); }
  }

  return <Box sx={{ maxWidth: 620, mx: "auto" }}>
    <Typography variant="overline" color="primary">Account</Typography>
    <Typography variant="h3" component="h1">Account settings</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Verify your new email address before it is saved.</Typography>
    <Paper sx={{ p: 3 }}>
      {message && <Alert severity={message.includes("successfully") || message.includes("sent") ? "success" : "error"} sx={{ mb: 2 }}>{message}</Alert>}
      <Stack spacing={2} component="form" onSubmit={verificationSent ? confirmEmail : requestVerification}>
        <TextField label="Username" value={account?.userName ?? ""} disabled />
        <TextField label="New email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {!verificationSent && <TextField label="Current password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />}
        {verificationSent && <TextField label="Email verification code" value={code} onChange={(event) => setCode(event.target.value)} required slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 6 } }} helperText="Enter the code sent to the new email address." />}
        <Button type="submit" variant="contained" disabled={isSaving}>{isSaving ? "Please wait..." : verificationSent ? "Verify and save email" : "Send verification code"}</Button>
      </Stack>
    </Paper>
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6">Notification settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose whether communications addressed to your employee account create notifications.</Typography>
      <Button variant={notificationsEnabled ? "contained" : "outlined"} onClick={() => updateNotificationSetting(!notificationsEnabled)}>{notificationsEnabled ? "Notifications enabled" : "Notifications disabled"}</Button>
    </Paper>
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Notifications</Typography>
      <Stack spacing={1}>{notifications.map((notification) => <Stack key={notification.notificationId} direction="row" sx={{ justifyContent: "space-between", gap: 2, p: 1, bgcolor: notification.isRead ? "transparent" : "action.hover" }}><Box><Typography sx={{ fontWeight: notification.isRead ? "normal" : "bold" }}>{notification.message}</Typography><Typography variant="caption" color="text.secondary">{new Date(notification.createdAt).toLocaleString()}</Typography></Box>{!notification.isRead && <Button size="small" onClick={() => markNotificationRead(notification.notificationId)}>Mark read</Button>}</Stack>)}{!notifications.length && <Typography color="text.secondary">No notifications yet.</Typography>}</Stack>
    </Paper>
  </Box>;
}

function readApiError(error: any, fallback: string) {
  const data = error.response?.data;
  return Array.isArray(data) ? data[0]?.description || fallback : typeof data === "string" ? data : data?.title || fallback;
}
