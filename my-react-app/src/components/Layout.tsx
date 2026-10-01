import { Box } from "@mui/material";
import Navbar from "./Navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Box className="app-layout">
      <Navbar />
      <Box component="main" className="page-content">
        {children}
      </Box>
    </Box>
  );
}
