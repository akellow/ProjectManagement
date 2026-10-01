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
      <Button color="inherit" component={Link} to="/account" onClick={closeMobileNav}>Account</Button>
      {user.app_metadata?.role === "superadmin" && <Button color="inherit" component={Link} to="/superadmin" onClick={closeMobileNav}>Admin</Button>}
      <Button color="inherit" onClick={handleLogout}>Logout</Button>
    </>
  ) : (
    <>
      <Button color="inherit" component={Link} to="/login" onClick={closeMobileNav}>Login</Button>
      <Button color="inherit" component={Link} to="/register" onClick={closeMobileNav}>Register</Button>
    </>
  );

  const navigationContent = (
    <Box className="navbar-links">
      {navigation}
    </Box>
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
