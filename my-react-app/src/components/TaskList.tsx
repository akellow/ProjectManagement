import { Button, TextField } from "@mui/material";
import { useAddTask, useDeleteTask, useTasks, useUpdateTask } from "../services/Query";

type Task = { id: number; name: string; status: string };

export default function TaskList() {
    const { data: tasks = [], isLoading, error } = useTasks();
    const addTask = useAddTask();
    const deleteTask = useDeleteTask();
    const updateTask = useUpdateTask();

    if (isLoading) return <p>Loading tasks...</p>;
    if (error) return <p>Error loading tasks</p>;

    return (
        <div className="tasks-page">
            <header className="tasks-header">
                <div>
                    <p className="eyebrow">Workspace</p>
                    <h1>Project tasks</h1>
                    <p className="auth-copy">Keep the next important thing within reach.</p>
                </div>
                <span className="task-count">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
            </header>

            <Button
            variant="contained"
            color="primary"
            onClick={() => addTask.mutate({ name: "New Task", status: "Pending" })}
            >
                Add Task
            </Button>

            <ul className="task-list">
                {tasks.map((task: Task) => (
                    <li key={task.id}>
                        <TextField
                        defaultValue={task.name}
                        onBlur={(event) =>
                            updateTask.mutate({ id: task.id, task: { name: event.target.value, status: task.status } })

                        }
                        />
                        {" - "}
                        {task.status}
                        <Button
                        variant="outlined"
                        color="error"
                        onClick={() => deleteTask.mutate(task.id)}
                        style={{ marginLeft: "1rem" }}
                        >
                            Delete
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}