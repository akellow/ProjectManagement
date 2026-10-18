import { Box, Button, Drawer, IconButton, Typography } from "@mui/material";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobileNav = () => setMobileOpen(false);
  const isActive = (path: string) =>
    pathname === path || (path === "/superadmin" && pathname.startsWith("/superadmin/"));
  const navLink = (path: string, label: string) => (
    <Button
      key={path}
      color="inherit"
      component={NavLink}
      to={path}
      onClick={closeMobileNav}
      onMouseEnter={() => preloadRoute(path)}
      onFocus={() => preloadRoute(path)}
      end={path !== "/superadmin"}
      className={isActive(path) ? "active" : undefined}
      aria-current={isActive(path) ? "page" : undefined}
    >
      {label}
    </Button>
  );

  const navigation = user ? (
    <>
      {navLink("/dashboard", "Dashboard")}
      {navLink("/projects", "Projects")}
      {navLink("/tasks", "Tasks")}
      {navLink("/employees", "Employees")}
      {navLink("/resources", "Resources")}
      {navLink("/milestones", "Milestones")}
      {navLink("/risks", "Risks")}
      {(user.app_metadata?.role === "admin" || user.app_metadata?.role === "superadmin") && (
        navLink("/communications", "Communications")
      )}
      {navLink("/notifications", "Notifications")}
      {navLink("/settings", "Settings")}
      {user.app_metadata?.role === "superadmin" && navLink("/superadmin", "Admin")}
    </>
  ) : (
    <>
      {navLink("/login", "Login")}
      {navLink("/register", "Register")}
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
