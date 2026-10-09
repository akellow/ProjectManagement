import { Box, Button, Drawer, IconButton, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
      <Button color="inherit" component={Link} to="/dashboard" onClick={closeMobileNav}>Dashboard</Button>
      <Button color="inherit" component={Link} to="/projects" onClick={closeMobileNav}>Projects</Button>
      <Button color="inherit" component={Link} to="/tasks" onClick={closeMobileNav}>Tasks</Button>
      <Button color="inherit" component={Link} to="/employees" onClick={closeMobileNav}>Employees</Button>
      <Button color="inherit" component={Link} to="/resources" onClick={closeMobileNav}>Resources</Button>
      <Button color="inherit" component={Link} to="/milestones" onClick={closeMobileNav}>Milestones</Button>
      <Button color="inherit" component={Link} to="/risks" onClick={closeMobileNav}>Risks</Button>
      <Button color="inherit" component={Link} to="/communications" onClick={closeMobileNav}>Communications</Button>
      {user.app_metadata?.role === "superadmin" && <Button color="inherit" component={Link} to="/superadmin" onClick={closeMobileNav}>Admin</Button>}
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
