import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import axios from "axios";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useConfirmAction } from "../components/useConfirmAction";

type Task = {
  projectTaskId: number;
  projectId: number;
  title: string;
  description?: string;
  status: string;
  startDate: string;
  endDate: string;
  priority: string;
};
type Project = { projectId: number; name: string };
type Employee = { employeeId: number; name: string; role: string };
type Assignment = { assignmentId: number; taskId: number; employeeId: number; hoursAllocated: number };
type TaskForm = { projectId: string; title: string; description: string; startDate: string; endDate: string; priority: string; status: string; employeeId: string; period: string; periodUnit: "hours" | "days" };

const statuses = ["Pending", "In Progress", "Completed", "Overdue"];
const priorities = ["Low", "Normal", "High"];
const emptyForm: TaskForm = { projectId: "", title: "", description: "", startDate: "", endDate: "", priority: "Normal", status: "Pending", employeeId: "", period: "1", periodUnit: "hours" };

export default function Tasks() {
  const { user } = useAuth();
  const { confirmAction, confirmationDialog } = useConfirmAction();
  const canManage = user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "superadmin";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [assignmentEmployee, setAssignmentEmployee] = useState("");
  const [assignmentHours, setAssignmentHours] = useState("8");
  const [assignmentPeriodUnit, setAssignmentPeriodUnit] = useState<"hours" | "days">("hours");
  const selectedTask = tasks.find((task) => task.projectTaskId === selectedId);
  const selectedAssignments = useMemo(() => assignments.filter((item) => item.taskId === selectedId), [assignments, selectedId]);

  const getCollection = async <T,>(endpoint: string) => {
    try {
      return (await api.get<T[]>(endpoint)).data;
    } catch {
      return [] as T[];
    }
  };

  const loadData = async (taskIdToSelect: number | null = selectedId) => {
    try {
      const [taskResponse, projectResponse, employeeData, assignmentData] = await Promise.all([
        api.get<Task[]>("/ProjectTasks"), api.get<Project[]>("/Projects"), getCollection<Employee>("/Employees"), getCollection<Assignment>("/Assignments"),
      ]);
      setTasks(taskResponse.data); setProjects(projectResponse.data); setEmployees(employeeData); setAssignments(assignmentData);
      const taskToSelect = taskResponse.data.find((task) => task.projectTaskId === taskIdToSelect) ?? taskResponse.data[0];
      if (taskToSelect) selectTask(taskToSelect, assignmentData);
    } catch {
      setError("Unable to load task workspace data.");
    }
  };

  useEffect(() => { void loadData(); }, []);

  function selectTask(task: Task, taskAssignments = assignments) {
    const assignment = taskAssignments.find((item) => item.taskId === task.projectTaskId);
    const period = assignment ? periodInput(assignment.hoursAllocated) : { period: "1", periodUnit: "hours" as const };
    setSelectedId(task.projectTaskId);
    setForm({ projectId: String(task.projectId), title: task.title, description: task.description ?? "", startDate: toDate(task.startDate), endDate: toDate(task.endDate), priority: task.priority, status: normalizeStatus(task.status), employeeId: assignment ? String(assignment.employeeId) : "", ...period });
    setIsEditing(false);
  }

  function startNewTask() {
    setSelectedId(null); setForm({ ...emptyForm, projectId: projects[0] ? String(projects[0].projectId) : "" }); setIsEditing(true);
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    const period = Number(form.period);
    if (!form.projectId || !form.title.trim()) { setError("Project and task title are required."); return; }
    if (!form.employeeId) { setError("Assign an employee before saving this task."); return; }
    if (!Number.isInteger(period) || period < 1) { setError("The assigned period must be a whole number greater than zero."); return; }
    const hoursAllocated = period * (form.periodUnit === "days" ? 24 : 1);
    const payload = { projectId: Number(form.projectId), title: form.title.trim(), description: form.description.trim() || null, startDate: toUtcIso(form.startDate), endDate: toUtcIso(form.endDate), status: form.status, priority: form.priority, employeeId: Number(form.employeeId), hoursAllocated };
    try {
      let taskId = selectedId;
      if (taskId) await api.put(`/ProjectTasks/${taskId}`, { title: payload.title, description: payload.description, status: payload.status, startDate: payload.startDate, endDate: payload.endDate, priority: payload.priority, employeeId: payload.employeeId, hoursAllocated });
      else { const response = await api.post<Task>("/ProjectTasks", payload); taskId = response.data.projectTaskId; }
      setIsEditing(false);
      await loadData(taskId);
    } catch (error) { setError(getApiError(error, "Unable to save task.")); }
  }

  async function deleteTask() {
    if (!selectedId || !await confirmAction("Move this task and its assignments and resource links to Trash? They can be restored together for 30 days.")) return;
    try { await api.delete(`/ProjectTasks/${selectedId}`); setSelectedId(null); setForm(emptyForm); await loadData(null); } catch (error) { setError(getApiError(error, "Unable to delete task.")); }
  }

  async function updateStatus(status: string) {
    if (!selectedId) return;
    try { await api.put(`/ProjectTasks/${selectedId}`, { status }); await loadData(selectedId); } catch (error) { setError(getApiError(error, "Unable to update task status.")); }
  }

  async function assignEmployee() {
    if (!selectedId || !assignmentEmployee) return;
    const period = Number(assignmentHours);
    if (!Number.isInteger(period) || period < 1) { setError("The assigned period must be a whole number greater than zero."); return; }
    try { await api.post("/Assignments", { taskId: selectedId, employeeId: Number(assignmentEmployee), hoursAllocated: period * (assignmentPeriodUnit === "days" ? 24 : 1) }); setAssignmentEmployee(""); await loadData(selectedId); } catch (error) { setError(getApiError(error, "Unable to assign employee.")); }
  }

  async function removeAssignment(id: number) {
    if (selectedAssignments.length <= 1) { setError("A task must have at least one assigned employee."); return; }
    if (!await confirmAction("Move this employee assignment to Trash? It can be restored for 30 days.")) return;
    try { await api.delete(`/Assignments/${id}`); await loadData(selectedId); } catch (error) { setError(getApiError(error, "Unable to remove assignment.")); }
  }

  return <Box sx={{ maxWidth: 1250, mx: "auto" }}>
    <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 2, mb: 3 }}>
      <Box><Typography variant="h3" component="h1">Tasks</Typography></Box>
      {canManage && <Button variant="contained" onClick={startNewTask}>New task</Button>}
    </Stack>
    {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
    {confirmationDialog}
    <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: "flex-start" }}>
      <Paper sx={{ width: { xs: "100%", md: 300 }, p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>All tasks</Typography>{tasks.map((task) => <Button key={task.projectTaskId} fullWidth onClick={() => selectTask(task)} sx={{ justifyContent: "space-between", mb: 0.5 }} variant={selectedId === task.projectTaskId ? "contained" : "text"}>{task.title}<Chip size="small" label={normalizeStatus(task.status)} /></Button>)}{!tasks.length && <Typography color="text.secondary">No tasks yet.</Typography>}</Paper>
      <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <Paper sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2, mb: 2 }}><Typography variant="h5">{selectedTask?.title ?? "Select a task"}</Typography>{canManage && selectedTask && <Stack direction="row" spacing={1}><Button onClick={() => setIsEditing(true)}>Edit</Button><Button color="error" onClick={deleteTask}>Delete</Button></Stack>}</Stack>
          {canManage && isEditing ? <TaskForm form={form} setForm={setForm} projects={projects} employees={employees} onSave={saveTask} onCancel={() => { if (selectedTask) selectTask(selectedTask); else { setIsEditing(false); setForm(emptyForm); } }} /> : selectedTask ? <TaskDetails task={selectedTask} projects={projects} /> : <Typography color="text.secondary">Select a task to view its details.</Typography>}
        </Paper>
        {selectedTask && <Paper sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>Task status and assignments</Typography>{canManage && <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, mb: 2 }}><Select value={normalizeStatus(selectedTask.status)} onChange={(event) => updateStatus(event.target.value)} size="small">{statuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select><Select value={assignmentEmployee} onChange={(event) => setAssignmentEmployee(event.target.value)} displayEmpty size="small"><MenuItem value="">Assign employee</MenuItem>{employees.map((employee) => <MenuItem key={employee.employeeId} value={employee.employeeId}>{employee.name} · {employee.role}</MenuItem>)}</Select><TextField label="Period" type="number" size="small" value={assignmentHours} onChange={(event) => setAssignmentHours(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} /><Select value={assignmentPeriodUnit} onChange={(event) => setAssignmentPeriodUnit(event.target.value as "hours" | "days")} size="small"><MenuItem value="hours">Hours</MenuItem><MenuItem value="days">Days (24 hours)</MenuItem></Select><Button variant="contained" onClick={assignEmployee} disabled={!assignmentEmployee}>Assign</Button></Stack>}<Divider />{selectedAssignments.map((assignment) => <Stack key={assignment.assignmentId} direction="row" sx={{ justifyContent: "space-between", py: 1 }}><Typography>{employees.find((employee) => employee.employeeId === assignment.employeeId)?.name ?? `Employee ${assignment.employeeId}`} · {formatPeriod(assignment.hoursAllocated)}</Typography>{canManage && selectedAssignments.length > 1 && <Button color="error" size="small" onClick={() => removeAssignment(assignment.assignmentId)}>Remove</Button>}</Stack>)}{!selectedAssignments.length && <Typography color="text.secondary" sx={{ mt: 2 }}>No employees assigned.</Typography>}</Paper>}
      </Box>
    </Stack>
  </Box>;
}

function TaskForm({ form, setForm, projects, employees, onSave, onCancel }: { form: TaskForm; setForm: (value: TaskForm) => void; projects: Project[]; employees: Employee[]; onSave: (event: FormEvent) => void; onCancel: () => void }) { return <Stack component="form" onSubmit={onSave} spacing={2}><TextField label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /><TextField label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} multiline minRows={2} /><Select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} displayEmpty required><MenuItem value="" disabled>Project</MenuItem>{projects.map((project) => <MenuItem key={project.projectId} value={project.projectId}>{project.name}</MenuItem>)}</Select><Select value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} displayEmpty required><MenuItem value="" disabled>Assign employee</MenuItem>{employees.map((employee) => <MenuItem key={employee.employeeId} value={employee.employeeId}>{employee.name} · {employee.role}</MenuItem>)}</Select><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField label="Start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /><TextField label="End date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField label="Period" type="number" value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })} slotProps={{ htmlInput: { min: 1, step: 1 } }} required fullWidth /><Select value={form.periodUnit} onChange={(event) => setForm({ ...form, periodUnit: event.target.value as "hours" | "days" })} fullWidth><MenuItem value="hours">Hours</MenuItem><MenuItem value="days">Days (24 hours)</MenuItem></Select></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} fullWidth>{statuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select><Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} fullWidth>{priorities.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</Select></Stack><Stack direction="row" spacing={1}><Button type="submit" variant="contained">Save task</Button><Button onClick={onCancel}>Cancel</Button></Stack></Stack>; }
function TaskDetails({ task, projects }: { task: Task; projects: Project[] }) { return <Stack spacing={1}><Typography>{task.description || "No description"}</Typography><Typography color="text.secondary">Project: {projects.find((project) => project.projectId === task.projectId)?.name ?? task.projectId}</Typography><Typography color="text.secondary">{toDate(task.startDate)} to {toDate(task.endDate)} · Priority: {task.priority}</Typography><Chip label={normalizeStatus(task.status)} sx={{ alignSelf: "flex-start" }} /></Stack>; }
function normalizeStatus(status: string) { return status.toLowerCase() === "in progress" ? "In Progress" : statuses.find((item) => item.toLowerCase() === status.toLowerCase()) ?? "Pending"; }
function toDate(value: string) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
function toUtcIso(value: string) { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : new Date().toISOString(); }
function formatPeriod(hours: number) { return hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"} (${hours} hours)` : `${hours} hours`; }
function periodInput(hours: number) { return hours % 24 === 0 ? { period: String(hours / 24), periodUnit: "days" as const } : { period: String(hours), periodUnit: "hours" as const }; }
function getApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (typeof responseData === "string" && responseData.trim()) return `${fallback} ${responseData}`;
    if (responseData && typeof responseData === "object") {
      if ("detail" in responseData && typeof responseData.detail === "string" && responseData.detail.trim())
        return `${fallback} ${responseData.detail}`;
      if ("message" in responseData && typeof responseData.message === "string" && responseData.message.trim())
        return `${fallback} ${responseData.message}`;
      if ("errors" in responseData && responseData.errors && typeof responseData.errors === "object") {
        const validationMessages = Object.values(responseData.errors)
          .flatMap((messages) => Array.isArray(messages) ? messages : [])
          .filter((message): message is string => typeof message === "string" && message.trim().length > 0);
        if (validationMessages.length) return `${fallback} ${validationMessages.join(" ")}`;
      }
      if ("title" in responseData && typeof responseData.title === "string" && responseData.title.trim())
        return `${fallback} ${responseData.title}`;
    }
    if (error.response?.status) return `${fallback} (HTTP ${error.response.status}).`;
    return `${fallback} ${error.message}`;
  }
  return fallback;
}
