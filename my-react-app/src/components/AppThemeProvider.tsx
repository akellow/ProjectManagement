import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useSettings } from "../context/SettingsContext";

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = useSettings();
  const [systemPrefersLight, setSystemPrefersLight] = useState(
    () => window.matchMedia("(prefers-color-scheme: light)").matches,
  );
  const resolvedMode = preferences.theme === "system"
    ? systemPrefersLight ? "light" : "dark"
    : preferences.theme;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const updatePreference = (event: MediaQueryListEvent) => setSystemPrefersLight(event.matches);
    setSystemPrefersLight(media.matches);
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedMode;
  }, [resolvedMode]);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: resolvedMode,
      primary: { main: resolvedMode === "dark" ? "#55b7aa" : "#176e66" },
      secondary: { main: "#d07d93" },
      background: resolvedMode === "dark"
        ? { default: "#101719", paper: "#182326" }
        : { default: "#f4f7f6", paper: "#ffffff" },
      text: resolvedMode === "dark"
        ? { primary: "#f4f7f8", secondary: "#c0cbcd" }
        : { primary: "#192426", secondary: "#526164" },
      divider: resolvedMode === "dark" ? "#344448" : "#d7e0df",
    },
  }), [resolvedMode]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
