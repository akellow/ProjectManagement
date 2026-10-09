import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabaseClient";

export type ThemeMode = "light" | "dark" | "system";
export type DateFormat = "locale" | "mdy" | "dmy" | "ymd";
export type WeekStart = "sunday" | "monday";

export type UserPreferences = {
  theme: ThemeMode;
  timeZone: string;
  dateFormat: DateFormat;
  weekStartsOn: WeekStart;
  notificationsEnabled: boolean;
};

type SettingsContextValue = {
  preferences: UserPreferences;
  saveSettings: (displayName: string, preferences: UserPreferences) => Promise<void>;
};

const defaultPreferences: UserPreferences = {
  theme: "dark",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  dateFormat: "locale",
  weekStartsOn: "monday",
  notificationsEnabled: true,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readPreferences(value: unknown): UserPreferences {
  if (typeof value !== "object" || value === null) return defaultPreferences;
  const saved = value as Partial<UserPreferences>;
  return {
    theme: saved.theme === "light" || saved.theme === "system" ? saved.theme : "dark",
    timeZone: typeof saved.timeZone === "string" && saved.timeZone ? saved.timeZone : defaultPreferences.timeZone,
    dateFormat: saved.dateFormat === "mdy" || saved.dateFormat === "dmy" || saved.dateFormat === "ymd"
      ? saved.dateFormat
      : "locale",
    weekStartsOn: saved.weekStartsOn === "sunday" ? "sunday" : "monday",
    notificationsEnabled: typeof saved.notificationsEnabled === "boolean" ? saved.notificationsEnabled : true,
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(defaultPreferences);

  useEffect(() => {
    setPreferences(readPreferences(user?.user_metadata?.preferences));
  }, [user?.id, user?.user_metadata?.preferences]);

  const saveSettings = useCallback(async (displayName: string, nextPreferences: UserPreferences) => {
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...user?.user_metadata,
        full_name: displayName.trim(),
        preferences: nextPreferences,
      },
    });

    if (error) throw new Error(error.message || "Unable to save your settings.");
    setPreferences(readPreferences(data.user.user_metadata.preferences));
  }, [user?.user_metadata]);

  const value = useMemo(() => ({ preferences, saveSettings }), [preferences, saveSettings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within a SettingsProvider.");
  return context;
}
