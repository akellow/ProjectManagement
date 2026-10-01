import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

type Project = { projectId: number; name: string; description?: string; startDate: string; endDate: string; budget: number };
type Task = { projectTaskId: number; projectId: number; title: string; description?: string; status: string; priority: string; startDate: string; endDate: string };
type Employee = { employeeId: number; name: string };
type Assignment = { assignmentId: number; taskId: number; employeeId: number; hoursAllocated: number };
type Resource = { resourceId: number; name: string };
type TaskResource = { taskResourceId: number; taskId: number; resourceId: number; quantity: number };
type Milestone = { milestoneId: number; projectId: number; name: string; dueDate: string; status: string };
type Risk = { riskId: number; projectId: number; description: string; probability: number; impact: string };
type Communication = { communicationId: number; projectId: number; message: string; date: string };
type ProjectForm = { name: string; description: string; startDate: string; endDate: string; budget: string };
const emptyProject: ProjectForm = { name: "", description: "", startDate: "", endDate: "", budget: "" };

export default function Projects() {
  const { user } = useAuth();
  const canManage = user?.app_metadata?.role === "admin" || user?.app_metadata?.role === "superadmin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [taskResources, setTaskResources] = useState<TaskResource[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [error, setError] = useState("");
  const selectedProject = projects.find((project) => project.projectId === selectedId);
  const projectTasks = useMemo(() => tasks.filter((task) => task.projectId === selectedId), [tasks, selectedId]);

  const getCollection = async <T,>(endpoint: string) => {
    try {
      return (await api.get<T[]>(endpoint)).data;
    } catch {
      return [] as T[];
    }
  };

  const loadData = async () => {
    try {
      const [projectData, taskData, employeeData, assignmentData, resourceData, taskResourceData, milestoneData, riskData, communicationData] = await Promise.all([
        api.get<Project[]>("/Projects").then((response) => response.data),
        getCollection<Task>("/ProjectTasks"), getCollection<Employee>("/Employees"), getCollection<Assignment>("/Assignments"),
        getCollection<Resource>("/Resources"), getCollection<TaskResource>("/TaskResources"), getCollection<Milestone>("/Milestones"), getCollection<Risk>("/Risks"), getCollection<Communication>("/Communications"),
      ]);
      setProjects(projectData); setTasks(taskData); setEmployees(employeeData); setAssignments(assignmentData); setResources(resourceData); setTaskResources(taskResourceData); setMilestones(milestoneData); setRisks(riskData); setCommunications(communicationData);
      if (selectedId === null && projectData[0]) selectProject(projectData[0]);
    } catch { setError("Unable to load project workspace data."); }
  };
  useEffect(() => { void loadData(); }, []);

  function selectProject(project: Project) {
    setSelectedId(project.projectId); setProjectForm({ name: project.name, description: project.description ?? "", startDate: toDate(project.startDate), endDate: toDate(project.endDate), budget: String(project.budget ?? "") }); setEditing(false);
  }
  const saveProject = async () => {
    if (!projectForm.name.trim()) return;
    const payload = { ...projectForm, budget: Number(projectForm.budget) || 0 };
    try { if (selectedId && editing) await api.put(`/Projects/${selectedId}`, { ...payload, projectId: selectedId }); else { const response = await api.post<Project>("/Projects", payload); setSelectedId(response.data.projectId); } await loadData(); setEditing(false); } catch { setError("Unable to save project."); }
  };
  const deleteProject = async () => { if (!selectedId || !window.confirm("Delete this project?")) return; try { await api.delete(`/Projects/${selectedId}`); setSelectedId(null); setProjectForm(emptyProject); await loadData(); } catch { setError("Unable to delete project."); } };
  const createRecord = async (endpoint: string, payload: Record<string, unknown>) => { try { await api.post(endpoint, payload); await loadData(); } catch { setError(`Unable to create ${endpoint.slice(1).toLowerCase()}.`); } };
  const createTask = () => selectedId && createRecord("/ProjectTasks", { projectId: selectedId, title: "New task", description: "", startDate: new Date().toISOString(), endDate: new Date().toISOString(), status: "Pending", priority: "Normal" });
  const updateTask = async (taskId: number, payload: Record<string, unknown>) => {
    try { await api.put(`/ProjectTasks/${taskId}`, payload); await loadData(); } catch { setError("Unable to update project task."); }
  };
  const deleteTask = async (taskId: number) => {
    if (!window.confirm("Delete this task?")) return;
    try { await api.delete(`/ProjectTasks/${taskId}`); await loadData(); } catch { setError("Unable to delete project task."); }
  };
  const projectMilestones = milestones.filter((item) => item.projectId === selectedId);
  const projectRisks = risks.filter((item) => item.projectId === selectedId);
  const projectCommunications = communications.filter((item) => item.projectId === selectedId);

  return <Box sx={{ maxWidth: 1250, mx: "auto" }}>
    <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", gap: 2, mb: 3 }}><Box><Typography variant="h3" component="h1">Projects</Typography></Box>{canManage && <Button variant="contained" onClick={() => { setSelectedId(null); setProjectForm(emptyProject); setEditing(true); }}>New project</Button>}</Stack>
    {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2, alignItems: "flex-start" }}>
      <Paper sx={{ width: { xs: "100%", md: 280 }, p: 2 }}><Typography variant="h6" sx={{ mb: 1 }}>All projects</Typography>{projects.map((project) => <Button key={project.projectId} fullWidth onClick={() => selectProject(project)} sx={{ justifyContent: "flex-start", mb: 0.5 }} variant={selectedId === project.projectId ? "contained" : "text"}>{project.name}</Button>)}{!projects.length && <Typography color="text.secondary">No projects yet.</Typography>}</Paper>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper sx={{ p: 3, mb: 2 }}><Stack direction="row" sx={{ justifyContent: "space-between", gap: 2, mb: 2 }}><Typography variant="h5">{selectedProject?.name ?? "Select a project"}</Typography>{canManage && selectedProject && <Stack direction="row" spacing={1}><Button onClick={() => setEditing(true)}>Edit</Button><Button color="error" onClick={deleteProject}>Delete</Button></Stack>}</Stack>{canManage && (editing || !selectedProject) ? <ProjectForm form={projectForm} setForm={setProjectForm} onSave={saveProject} onCancel={() => selectedProject && selectProject(selectedProject)} /> : selectedProject ? <ProjectDetails project={selectedProject} /> : <Typography color="text.secondary">Select a project to view its details.</Typography>}</Paper>
        {selectedProject && <Paper sx={{ p: 2 }}><Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto"><Tab label="Tasks" /><Tab label="Assignments" /><Tab label="Milestones" /><Tab label="Risks" /><Tab label="Resources" /><Tab label="Communications" /></Tabs><Divider sx={{ mb: 2 }} />
          {activeTab === 0 && <TaskPanel tasks={projectTasks} canManage={canManage} onAdd={createTask} onUpdate={updateTask} onDelete={deleteTask} />}
          {activeTab === 1 && <AssignmentPanel canManage={canManage} tasks={projectTasks} employees={employees} assignments={assignments.filter((item) => projectTasks.some((task) => task.projectTaskId === item.taskId))} onSubmit={async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await createRecord("/Assignments", { taskId: Number(data.get("taskId")), employeeId: Number(data.get("employeeId")), hoursAllocated: Number(data.get("hoursAllocated")) || 0 }); }} />}
          {activeTab === 2 && <RecordPanel canManage={canManage} title="Milestones" items={projectMilestones.map((item) => `${item.name} · ${item.status} · ${toDate(item.dueDate)}`)} actionLabel="Add milestone" onAdd={() => createRecord("/Milestones", { projectId: selectedId, name: "New milestone", dueDate: new Date().toISOString(), status: "Pending" })} />}
          {activeTab === 3 && <RecordPanel canManage={canManage} title="Risks" items={projectRisks.map((item) => `${item.description} · ${item.impact} impact · ${item.probability * 100}% probability`)} actionLabel="Log risk" onAdd={() => createRecord("/Risks", { projectId: selectedId, description: "New risk", probability: 0.5, impact: "Medium" })} />}
          {activeTab === 4 && <ResourcePanel canManage={canManage} resources={resources} taskResources={taskResources.filter((item) => projectTasks.some((task) => task.projectTaskId === item.taskId))} onAdd={(resourceId, taskId) => createRecord("/TaskResources", { resourceId, taskId, quantity: 1 })} />}
          {activeTab === 5 && <RecordPanel canManage={canManage} title="Communications" items={projectCommunications.map((item) => `${item.message} · ${toDate(item.date)}`)} actionLabel="Add communication" onAdd={() => createRecord("/Communications", { projectId: selectedId, employeeId: employees[0]?.employeeId ?? 0, message: "New project update", date: new Date().toISOString() })} />}
        </Paper>}
      </Box>
    </Stack>
  </Box>;
}

function ProjectForm({ form, setForm, onSave, onCancel }: { form: ProjectForm; setForm: (value: ProjectForm) => void; onSave: () => void; onCancel: () => void }) { return <Stack spacing={2}><TextField label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><TextField label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} multiline /><Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField label="Start date" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /><TextField label="End date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth /><TextField label="Budget" type="number" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} fullWidth /></Stack><Stack direction="row" spacing={1}><Button variant="contained" onClick={onSave}>Save project</Button><Button onClick={onCancel}>Cancel</Button></Stack></Stack>; }
function ProjectDetails({ project }: { project: Project }) { return <Stack direction={{ xs: "column", sm: "row" }} spacing={3}><Box><Typography variant="caption">Description</Typography><Typography>{project.description || "No description"}</Typography></Box><Box><Typography variant="caption">Timeline</Typography><Typography>{toDate(project.startDate)} to {toDate(project.endDate)}</Typography></Box><Box><Typography variant="caption">Budget</Typography><Typography>${project.budget.toLocaleString()}</Typography></Box></Stack>; }
function TaskPanel({ tasks, canManage, onAdd, onUpdate, onDelete }: { tasks: Task[]; canManage: boolean; onAdd: () => void; onUpdate: (taskId: number, payload: Record<string, unknown>) => Promise<void>; onDelete: (taskId: number) => Promise<void> }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: "", description: "", status: "Pending", priority: "Normal" });

  function beginEdit(task: Task) {
    setEditingId(task.projectTaskId);
    setDraft({ title: task.title, description: task.description ?? "", status: task.status, priority: task.priority });
  }

  async function saveEdit(task: Task) {
    await onUpdate(task.projectTaskId, draft);
    setEditingId(null);
  }

  return <Stack spacing={1}>
    {canManage && <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={onAdd}>Add task</Button>}
    {tasks.map((task) => canManage && editingId === task.projectTaskId ? (
      <Paper key={task.projectTaskId} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <TextField size="small" label="Task title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <TextField size="small" label="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Select size="small" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })} fullWidth>{["Pending", "In Progress", "Completed"].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</Select>
            <Select size="small" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })} fullWidth>{["Low", "Normal", "High"].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</Select>
          </Stack>
          <Stack direction="row" spacing={1}><Button variant="contained" onClick={() => saveEdit(task)}>Save</Button><Button onClick={() => setEditingId(null)}>Cancel</Button></Stack>
        </Stack>
      </Paper>
    ) : (
      <Stack key={task.projectTaskId} direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 1, borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
        <Box sx={{ flex: 1 }}><Typography>{task.title}</Typography><Typography variant="body2" color="text.secondary">{task.description || "No description"}</Typography></Box>
        <Chip size="small" label={`${task.status} · ${task.priority}`} />
        {canManage && <Stack direction="row" spacing={1}><Button size="small" onClick={() => beginEdit(task)}>Edit</Button><Button size="small" color="error" onClick={() => onDelete(task.projectTaskId)}>Delete</Button></Stack>}
      </Stack>
    ))}
    {!tasks.length && <Typography color="text.secondary">No tasks for this project.</Typography>}
  </Stack>;
}
function AssignmentPanel({ canManage, tasks, employees, assignments, onSubmit }: { canManage: boolean; tasks: Task[]; employees: Employee[]; assignments: Assignment[]; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <Stack spacing={2}>{canManage && <Box component="form" onSubmit={onSubmit}><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Select name="taskId" defaultValue={tasks[0]?.projectTaskId ?? ""} displayEmpty size="small"><MenuItem value="" disabled>Task</MenuItem>{tasks.map((task) => <MenuItem key={task.projectTaskId} value={task.projectTaskId}>{task.title}</MenuItem>)}</Select><Select name="employeeId" defaultValue={employees[0]?.employeeId ?? ""} displayEmpty size="small"><MenuItem value="" disabled>Employee</MenuItem>{employees.map((employee) => <MenuItem key={employee.employeeId} value={employee.employeeId}>{employee.name}</MenuItem>)}</Select><TextField name="hoursAllocated" label="Hours" type="number" size="small" defaultValue={8} /><Button type="submit" variant="contained">Assign</Button></Stack></Box>}{assignments.map((assignment) => <Typography key={assignment.assignmentId}>Employee {assignment.employeeId} · Task {assignment.taskId} · {assignment.hoursAllocated} hours</Typography>)}{!assignments.length && <Typography color="text.secondary">No employees assigned yet.</Typography>}</Stack>; }
function ResourcePanel({ canManage, resources, taskResources, onAdd }: { canManage: boolean; resources: Resource[]; taskResources: TaskResource[]; onAdd: (resourceId: number, taskId: number) => void }) { const [resourceId, setResourceId] = useState(""); const [taskId, setTaskId] = useState(""); return <Stack spacing={2}>{canManage && <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Select value={resourceId} onChange={(event) => setResourceId(event.target.value)} displayEmpty size="small"><MenuItem value="">Resource</MenuItem>{resources.map((resource) => <MenuItem key={resource.resourceId} value={resource.resourceId}>{resource.name}</MenuItem>)}</Select><TextField label="Task ID" type="number" size="small" value={taskId} onChange={(event) => setTaskId(event.target.value)} /><Button variant="contained" onClick={() => resourceId && taskId && onAdd(Number(resourceId), Number(taskId))}>Add resource</Button></Stack>}{taskResources.map((item) => <Typography key={item.taskResourceId}>Resource {item.resourceId} · Task {item.taskId} · Quantity {item.quantity}</Typography>)}{!taskResources.length && <Typography color="text.secondary">No resources assigned yet.</Typography>}</Stack>; }
function RecordPanel({ canManage, title, items, actionLabel, onAdd }: { canManage: boolean; title: string; items: string[]; actionLabel: string; onAdd: () => void }) { return <Stack spacing={1}>{canManage && <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={onAdd}>{actionLabel}</Button>}{items.map((item) => <Typography key={item} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>{item}</Typography>)}{!items.length && <Typography color="text.secondary">No {title.toLowerCase()} recorded yet.</Typography>}</Stack>; }
function toDate(value: string) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
