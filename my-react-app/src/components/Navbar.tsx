import { Box, Button, Drawer, IconButton, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("../pages/Dashboard"),
  "/projects": () => import("../pages/Projects"),
  "/tasks": () => import("../pages/Tasks"),
  "/employees": () => import("../pages/Employees"),
  "/resources": () => import("../pages/Resources"),
  "/milestones": () => import("../pages/Milestones"),
  "/risks": () => import("../pages/Risks"),
  "/communications": () => import("../pages/Communications"),
  "/settings": () => import("../pages/Settings"),
  "/superadmin": () => import("../pages/SuperAdmin"),
};

function preloadRoute(path: string) {
  void routePreloaders[path]?.();
}

export default function Navbar() {
   const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileNav = () => setMobileOpen(false);
    const handleLogout = () => {
      closeMobileNav();
      signOut();
  };

  const navigation = user ? (
    <>
      <Button color="inherit" component={Link} to="/dashboard" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/dashboard")} onFocus={() => preloadRoute("/dashboard")}>Dashboard</Button>
      <Button color="inherit" component={Link} to="/projects" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/projects")} onFocus={() => preloadRoute("/projects")}>Projects</Button>
      <Button color="inherit" component={Link} to="/tasks" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/tasks")} onFocus={() => preloadRoute("/tasks")}>Tasks</Button>
      <Button color="inherit" component={Link} to="/employees" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/employees")} onFocus={() => preloadRoute("/employees")}>Employees</Button>
      <Button color="inherit" component={Link} to="/resources" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/resources")} onFocus={() => preloadRoute("/resources")}>Resources</Button>
      <Button color="inherit" component={Link} to="/milestones" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/milestones")} onFocus={() => preloadRoute("/milestones")}>Milestones</Button>
      <Button color="inherit" component={Link} to="/risks" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/risks")} onFocus={() => preloadRoute("/risks")}>Risks</Button>
      <Button color="inherit" component={Link} to="/communications" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/communications")} onFocus={() => preloadRoute("/communications")}>Communications</Button>
      {user.app_metadata?.role === "superadmin" && <Button color="inherit" component={Link} to="/superadmin" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/superadmin")} onFocus={() => preloadRoute("/superadmin")}>Admin</Button>}
    </>
  ) : (
    <>
      <Button color="inherit" component={Link} to="/login" onClick={closeMobileNav}>Login</Button>
      <Button color="inherit" component={Link} to="/register" onClick={closeMobileNav}>Register</Button>
    </>
  );

  const navigationContent = (
    <>
      <Box className="navbar-links">{navigation}</Box>
      {user && (
        <Box className="navbar-bottom-links">
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
          <Button
            color="inherit"
            component={Link}
            to="/settings"
            onClick={closeMobileNav}
            onMouseEnter={() => preloadRoute("/settings")}
            onFocus={() => preloadRoute("/settings")}
            startIcon={<SettingsIcon />}
          >
            Settings
          </Button>
        </Box>
      )}
    </>
  );

  return (
    <>
      <Box component="aside" className="desktop-navbar">
        <Box className="navbar-brand">
          <Typography variant="h6">Project Management</Typography>
          <Typography variant="caption">Workspace</Typography>
        </Box>
        {navigationContent}
      </Box>

      <Box component="nav" className="mobile-navbar" aria-label="Mobile navigation">
          <IconButton
            color="inherit"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            edge="start"
          >
            <span aria-hidden="true" className="menu-icon" />
          </IconButton>
      </Box>

      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={closeMobileNav}
        className="mobile-drawer"
        slotProps={{ paper: { className: "mobile-drawer-paper" } }}
      >
        <Box className="navbar-brand">
          <Typography variant="h6">Project Management</Typography>
          <Typography variant="caption">Workspace</Typography>
        </Box>
        {navigationContent}
      </Drawer>
    </>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3Z" />
    </svg>
  );
}
