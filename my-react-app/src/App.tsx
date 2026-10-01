import './App.css';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SuperAdminRoute from './components/SuperAdminRoute';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Employees = lazy(() => import('./pages/Employees'));
const Resources = lazy(() => import('./pages/Resources'));
const Milestones = lazy(() => import('./pages/Milestones'));
const Risks = lazy(() => import('./pages/Risks'));
const Communications = lazy(() => import('./pages/Communications'));
const Account = lazy(() => import('./pages/Account'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));

function WorkspaceLayout() {
  return (
    <ProtectedRoute>
      <Layout><Outlet /></Layout>
    </ProtectedRoute>
  );
}

function AppShell() {
  return (
    <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading page" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<WorkspaceLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/milestones" element={<Milestones />} />
          <Route path="/risks" element={<Risks />} />
          <Route path="/communications" element={<Communications />} />
          <Route path="/account" element={<Account />} />
          <Route
            path="/superadmin"
            element={
              <SuperAdminRoute>
                <SuperAdmin />
              </SuperAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

