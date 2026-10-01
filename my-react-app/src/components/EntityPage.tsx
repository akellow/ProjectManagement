import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type EntityPageProps = {
  title: string;
  endpoint: string;
  columns: { key: string; label: string }[];
  idKey: string;
  fields: { key: string; label: string; type?: string; options?: string[] }[];
};
type Project = { projectId: number; name: string };
type Employee = { employeeId: number; name: string };

export default function EntityPage({ title, endpoint, columns, idKey, fields }: EntityPageProps) {
  const { user } = useAuth();
  const canManage = user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "superadmin";
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const loadItems = async () => {
    const response = await api.get<Record<string, unknown>[]>(endpoint);
    setItems(response.data);
    if (fields.some((field) => field.key === "projectId")) {
      const projectResponse = await api.get<Project[]>("/Projects");
      setProjects(projectResponse.data);
    }
    if (fields.some((field) => field.key === "employeeId")) {
      const employeeResponse = await api.get<Employee[]>("/Employees");
      setEmployees(employeeResponse.data);
    }
  };

  useEffect(() => {
    let isMounted = true;

    loadItems()
      .then(() => undefined)
      .catch(() => {
        if (isMounted) setError(`Unable to load ${title.toLowerCase()}.`);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [endpoint, title]);

  function startCreate() {
    setEditingId("new");
    setForm(Object.fromEntries(fields.map((field) => [field.key, ""])));
  }

  function startEdit(item: Record<string, unknown>) {
    setEditingId(String(item[idKey]));
    setForm(Object.fromEntries(fields.map((field) => [field.key, formatFormValue(item[field.key], field.type)])));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(fields.map((field) => [field.key, toApiValue(form[field.key], field.type)]));
      if (editingId === "new") await api.post(endpoint, payload);
      else await api.put(`${endpoint}/${editingId}`, { ...payload, [idKey]: Number(editingId) });
      setEditingId(null); await loadItems();
    } catch { setError(`Unable to save ${title.toLowerCase()}.`); }
  }

  async function remove(id: string) {
    if (!window.confirm(`Delete this ${title.toLowerCase().replace(/s$/, "")}?`)) return;
    try { await api.delete(`${endpoint}/${id}`); await loadItems(); } catch { setError(`Unable to delete ${title.toLowerCase()}.`); }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}><Box><Typography variant="h4">{title}</Typography><Typography variant="body2" color="text.secondary">{canManage ? "Admin editing enabled" : "View only"}</Typography></Box>{canManage && <Button variant="contained" onClick={startCreate}>Add {title.slice(0, -1)}</Button>}</Stack>
      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {!isLoading && !error && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => <TableCell key={column.key}>{column.label}</TableCell>)}
                {canManage && <TableCell>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + (canManage ? 1 : 0)}>No {title.toLowerCase()} found.</TableCell></TableRow>
              ) : items.map((item, index) => (
                <TableRow key={String(item.id ?? item[columns[0].key] ?? index)}>
                  {columns.map((column) => <TableCell key={column.key}>{column.key === "projectId" ? projectName(item[column.key], projects) : column.key === "employeeId" ? employeeName(item[column.key], employees) : formatDisplayValue(item[column.key], column.key)}</TableCell>)}
                  {canManage && <TableCell><Button size="small" onClick={() => startEdit(item)}>Edit</Button><Button size="small" color="error" onClick={() => remove(String(item[idKey]))}>Delete</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {editingId && <Paper component="form" onSubmit={save} sx={{ p: 3, mt: 2 }}><Stack spacing={2}>{fields.map((field) => field.key === "projectId" ? <Select key={field.key} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} displayEmpty required><MenuItem value="" disabled>Select project</MenuItem>{projects.map((project) => <MenuItem key={project.projectId} value={project.projectId}>{project.name}</MenuItem>)}</Select> : field.key === "employeeId" ? <Select key={field.key} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} displayEmpty required><MenuItem value="" disabled>Select employee</MenuItem>{employees.map((employee) => <MenuItem key={employee.employeeId} value={employee.employeeId}>{employee.name}</MenuItem>)}</Select> : field.options ? <Select key={field.key} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} displayEmpty required><MenuItem value="" disabled>{field.label}</MenuItem>{field.options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</Select> : <TextField key={field.key} label={field.label} type={field.type ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required={field.key !== "mitigationPlan"} slotProps={field.type === "datetime-local" ? { inputLabel: { shrink: true } } : undefined} />)}<Stack direction="row" spacing={1}><Button type="submit" variant="contained">Save</Button><Button onClick={() => setEditingId(null)}>Cancel</Button></Stack></Stack></Paper>}
    </Box>
  );
}

function formatFormValue(value: unknown, type?: string) {
  if (type === "riskProbability") return Number(value) >= 0.5 ? "High" : "Low";
  if (type === "datetime-local" && value) return new Date(String(value)).toISOString().slice(0, 16);
  if (type === "boolean") return String(Boolean(value));
  return String(value ?? "");
}

function toApiValue(value: string, type?: string) {
  if (type === "riskProbability") return value === "High" ? 1 : 0;
  if (type === "number") return Number(value) || 0;
  if (type === "boolean") return value === "true";
  if (type === "datetime-local") return value ? new Date(value).toISOString() : new Date().toISOString();
  return value;
}

function formatDisplayValue(value: unknown, key?: string) {
  if (key === "probability") return Number(value) >= 0.5 ? "High" : "Low";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "-");
}

function projectName(value: unknown, projects: Project[]) {
  const project = projects.find((item) => item.projectId === Number(value));
  return project?.name ?? String(value ?? "-");
}

function employeeName(value: unknown, employees: Employee[]) {
  const employee = employees.find((item) => item.employeeId === Number(value));
  return employee?.name ?? String(value ?? "-");
}
