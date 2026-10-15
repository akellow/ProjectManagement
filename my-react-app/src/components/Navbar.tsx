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
  "/notifications": () => import("../pages/Notifications"),
  "/superadmin": () => import("../pages/SuperAdmin"),
  "/superadmin/users": () => import("../pages/SystemUsers"),
  "/superadmin/invite": () => import("../pages/InviteUser"),
};

function preloadRoute(path: string) {
  void routePreloaders[path]?.();
}

export default function Navbar() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileNav = () => setMobileOpen(false);

  const navigation = user ? (
    <>
      <Button color="inherit" component={Link} to="/dashboard" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/dashboard")} onFocus={() => preloadRoute("/dashboard")}>Dashboard</Button>
      <Button color="inherit" component={Link} to="/projects" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/projects")} onFocus={() => preloadRoute("/projects")}>Projects</Button>
      <Button color="inherit" component={Link} to="/tasks" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/tasks")} onFocus={() => preloadRoute("/tasks")}>Tasks</Button>
      <Button color="inherit" component={Link} to="/employees" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/employees")} onFocus={() => preloadRoute("/employees")}>Employees</Button>
      <Button color="inherit" component={Link} to="/resources" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/resources")} onFocus={() => preloadRoute("/resources")}>Resources</Button>
      <Button color="inherit" component={Link} to="/milestones" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/milestones")} onFocus={() => preloadRoute("/milestones")}>Milestones</Button>
      <Button color="inherit" component={Link} to="/risks" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/risks")} onFocus={() => preloadRoute("/risks")}>Risks</Button>
      {(user.app_metadata?.role === "admin" || user.app_metadata?.role === "superadmin") && (
        <Button color="inherit" component={Link} to="/communications" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/communications")} onFocus={() => preloadRoute("/communications")}>Communications</Button>
      )}
      {user.app_metadata?.role === "superadmin" && <Button color="inherit" component={Link} to="/superadmin" onClick={closeMobileNav} onMouseEnter={() => preloadRoute("/superadmin")} onFocus={() => preloadRoute("/superadmin")}>Admin</Button>}
    </>
  ) : (
    <>
      <Button color="inherit" component={Link} to="/login" onClick={closeMobileNav}>Login</Button>
      <Button color="inherit" component={Link} to="/register" onClick={closeMobileNav}>Register</Button>
    </>
  );

  const navigationContent = (
    <Box className="navbar-links">{navigation}</Box>
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
