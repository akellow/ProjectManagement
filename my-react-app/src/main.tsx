import React from "react";
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import App from './App';
import { AuthProvider } from "./context/AuthContext";
import './index.css';


const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#55b7aa' },
    secondary: { main: '#d07d93' },
    background: { default: '#101719', paper: '#182326' },
    text: { primary: '#f4f7f8', secondary: '#c0cbcd' },
    divider: '#344448',
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);