import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type Employee = { employeeId: number; name: string; role: string; department: string; contactInfo: string; userId: string | null };
type Task = { projectTaskId: number; projectId: number; title: string; description?: string; status: string; priority: string; startDate: string; endDate: string };
type Assignment = { assignmentId: number; taskId: number; employeeId: number; hoursAllocated: number };
type Project = { projectId: number; name: string };
type ProjectEmployee = { projectEmployeeId: number; projectId: number; employeeId: number };
type TaskForm = { title: string; description: string; status: string; priority: string; startDate: string; endDate: string };

const statuses = ["Pending", "In Progress", "Completed"];
const priorities = ["Low", "Normal", "High"];

export default function Employees() {
  const { user } = useAuth();
  const canManage = user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "superadmin";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectEmployees, setProjectEmployees] = useState<ProjectEmployee[]>([]);
  const [projectToAssign, setProjectToAssign] = useState("");
  const [employeesToAssign, setEmployeesToAssign] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);
  const [error, setError] = useState("");
  const selectedEmployee = employees.find((employee) => employee.employeeId === selectedEmployeeId);
  const assignedTaskIds = useMemo(() => assignments.filter((item) => item.employeeId === selectedEmployeeId).map((item) => item.taskId), [assignments, selectedEmployeeId]);
  const employeeTasks = tasks.filter((task) => assignedTaskIds.includes(task.projectTaskId));
  const selectedTask = tasks.find((task) => task.projectTaskId === selectedTaskId);

  async function loadData() {
    try {
      const [employeeResponse, taskResponse, assignmentResponse, projectResponse, projectEmployeeResponse] = await Promise.all([
        api.get<Employee[]>("/Employees"), api.get<Task[]>("/ProjectTasks"), api.get<Assignment[]>("/Assignments"), api.get<Project[]>("/Projects"), api.get<ProjectEmployee[]>("/ProjectEmployees"),
      ]);
      setEmployees(employeeResponse.data); setTasks(taskResponse.data); setAssignments(assignmentResponse.data); setProjects(projectResponse.data); setProjectEmployees(projectEmployeeResponse.data);
      if (selectedEmployeeId === null && employeeResponse.data[0]) setSelectedEmployeeId(employeeResponse.data[0].employeeId);
    } catch { setError("Unable to load employee task data."); }
  }

  useEffect(() => { void loadData(); }, []);

  function selectTask(task: Task) {
    setSelectedTaskId(task.projectTaskId);
    setTaskForm({ title: task.title, description: task.description ?? "", status: normalizeStatus(task.status), priority: task.priority, startDate: toDate(task.startDate), endDate: toDate(task.endDate) });
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!selectedTaskId || !taskForm) return;
    try { await api.put(`/ProjectTasks/${selectedTaskId}`, { title: taskForm.title.trim(), description: taskForm.description.trim() || null, status: taskForm.status, priority: taskForm.priority, startDate: taskForm.startDate || null, endDate: taskForm.endDate || null }); await loadData(); } catch { setError("Unable to update task."); }
  }

  async function removeTask(taskId: number) {
    const assignment = assignments.find((item) => item.employeeId === selectedEmployeeId && item.taskId === taskId);
    if (!assignment) return;
    try { await api.delete(`/Assignments/${assignment.assignmentId}`); if (selectedTaskId === taskId) { setSelectedTaskId(null); setTaskForm(null); } await loadData(); } catch { setError("Unable to remove task from employee."); }
  }

  async function assignProject() {
    if (!projectToAssign || !employeesToAssign.length) return;
    try {
      await Promise.all(employeesToAssign.map((employeeId) => api.post("/ProjectEmployees", { employeeId: Number(employeeId), projectId: Number(projectToAssign) })));
      setProjectToAssign(""); setEmployeesToAssign([]); await loadData();
    } catch { setError("Unable to assign one or more employees to the project."); }
  }

  async function removeProjectAssignment(id: number) {
    try { await api.delete(`/ProjectEmployees/${id}`); await loadData(); } catch { setError("Unable to remove project assignment."); }
  }

  async function deleteEmployee(employeeId: number) {
    if (!window.confirm("Remove this employee and their assignments and communications? This cannot be undone.")) return;
    try {
      await api.delete(`/Employees/${employeeId}`);
      setSelectedEmployeeId(null);
      setSelectedTaskId(null);
      setTaskForm(null);
      await loadData();
    } catch {
      setError("Unable to remove employee.");
    }
  }

  return <Box sx={{ maxWidth: 1200, mx: "auto" }}>
    <Typography variant="h3" component="h1">Employees</Typography>
    {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: "flex-start" }}>
      <Paper sx={{ width: { xs: "100%", md: 300 }, p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>Employees</Typography>{employees.map((employee) => <Button key={employee.employeeId} fullWidth onClick={() => { setSelectedEmployeeId(employee.employeeId); setSelectedTaskId(null); setTaskForm(null); }} variant={selectedEmployeeId === employee.employeeId ? "contained" : "text"} sx={{ justifyContent: "flex-start", mb: 0.5 }}>{employee.name}</Button>)}{!employees.length && <Typography color="text.secondary">No employees found.</Typography>}</Paper>
      <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        <Paper sx={{ p: 3, mb: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2 }}><Box><Typography variant="h5">{selectedEmployee?.name ?? "Employee directory"}</Typography>{selectedEmployee && <Typography color="text.secondary">{selectedEmployee.role} · {selectedEmployee.department} · {selectedEmployee.contactInfo}</Typography>}</Box>{canManage && selectedEmployee && selectedEmployee.userId !== user?.id && <Button color="error" onClick={() => deleteEmployee(selectedEmployee.employeeId)}>Remove employee</Button>}</Stack>{canManage && <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, mt: 2 }}><Select value={projectToAssign} onChange={(event) => setProjectToAssign(event.target.value)} displayEmpty size="small"><MenuItem value="">Project to assign</MenuItem>{projects.map((project) => <MenuItem key={project.projectId} value={project.projectId}>{project.name}</MenuItem>)}</Select><Select multiple value={employeesToAssign} onChange={(event) => setEmployeesToAssign(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)} displayEmpty size="small" renderValue={(selected) => `${selected.length} employee${selected.length === 1 ? "" : "s"} selected`}><MenuItem value="" disabled>Select employees</MenuItem>{employees.filter((employee) => !projectEmployees.some((item) => item.projectId === Number(projectToAssign) && item.employeeId === employee.employeeId)).map((employee) => <MenuItem key={employee.employeeId} value={String(employee.employeeId)}>{employee.name}</MenuItem>)}</Select><Button variant="contained" onClick={assignProject} disabled={!projectToAssign || !employeesToAssign.length}>Assign employees</Button></Stack>}</Paper>
        <Paper sx={{ p: 3, mb: 2 }}><Typography variant="h6" sx={{ mb: 2 }}>Employee project assignments</Typography><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Project</TableCell><TableCell>Role</TableCell>{canManage && <TableCell>Action</TableCell>}</TableRow></TableHead><TableBody>{projectEmployees.map((assignment) => { const employee = employees.find((item) => item.employeeId === assignment.employeeId); const project = projects.find((item) => item.projectId === assignment.projectId); return <TableRow key={assignment.projectEmployeeId}><TableCell>{employee?.name ?? `Employee ${assignment.employeeId}`}</TableCell><TableCell>{project?.name ?? `Project ${assignment.projectId}`}</TableCell><TableCell>{employee?.role ?? "-"}</TableCell>{canManage && <TableCell><Button size="small" color="error" onClick={() => removeProjectAssignment(assignment.projectEmployeeId)}>Remove</Button></TableCell>}</TableRow>; })}</TableBody></Table>{!projectEmployees.length && <Typography color="text.secondary">No project assignments yet.</Typography>}</Paper>
        <Paper sx={{ p: 3 }}><Typography variant="h6" sx={{ mb: 2 }}>Assigned tasks</Typography>{employeeTasks.map((task) => <Stack key={task.projectTaskId} direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider", py: 1 }}><Button onClick={() => selectTask(task)} sx={{ justifyContent: "flex-start", textAlign: "left" }}>{task.title}</Button><Chip size="small" label={normalizeStatus(task.status)} color={normalizeStatus(task.status) === "Completed" ? "success" : "default"} />{canManage && <Button size="small" color="error" onClick={() => removeTask(task.projectTaskId)}>Remove</Button>}</Stack>)}{!employeeTasks.length && <Typography color="text.secondary">No tasks assigned to this employee.</Typography>}</Paper>
        {canManage && selectedTask && taskForm && <Paper component="form" onSubmit={saveTask} sx={{ p: 3, mt: 2 }}><Typography variant="h6" sx={{ mb: 2 }}>Update task</Typography><Stack spacing={2}><TextField label="Title" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required /><TextField label="Description" value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} multiline minRows={2} /><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><Select value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })} fullWidth>{statuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select><Select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })} fullWidth>{priorities.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</Select></Stack><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField label="Start date" type="date" value={taskForm.startDate} onChange={(event) => setTaskForm({ ...taskForm, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /><TextField label="End date" type="date" value={taskForm.endDate} onChange={(event) => setTaskForm({ ...taskForm, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /></Stack><Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Save task changes</Button><Typography variant="body2" color="text.secondary">Project: {projects.find((project) => project.projectId === selectedTask.projectId)?.name ?? selectedTask.projectId}</Typography></Stack></Paper>}
      </Box>
    </Stack>
  </Box>;
}

function normalizeStatus(status: string) { return statuses.find((item) => item.toLowerCase() === status.toLowerCase()) ?? "Pending"; }
function toDate(value: string) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
