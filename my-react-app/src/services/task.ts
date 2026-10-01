import api from "./api";

export const fetchTasks = async () => {
    const res = await api.get("/ProjectTasks");
    return res.data;
};

export const addTask = async (task: { name: string; status: string }) => {
    await api.post("/ProjectTask", task);
};

export const deleteTask = async (id: number) => {
    await api.delete(`/ProjectTasks/${id}`);
}