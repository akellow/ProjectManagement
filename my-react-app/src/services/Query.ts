import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./api";
import { gql } from "@apollo/client";


export const GET_TASK = gql`
   query {
       projectTasks {
        id 
        name 
        status 
       }
    }
    `;

export const fetchTasks = async () => {
    const { data } = await api.get("/ProjectTasks");
    return data;
};

export const fetchTaskById = async (id: number) => {
    const { data } = await api.get(`/ProjectTasks/${id}`);
    return data;
};

export const addTask = async (task: { name: string; status: string }) => {
    const { data } = await api.post("/ProjectTasks", task);
    return data;
};

export const updateTask = async (id: number, task: {name: string; status: string }) => {
    const { data } = await api.put(`/ProjectTasks/${id}`, task);
    return data;
}

export const deleteTask = async (id: number) => {
    await api.delete(`/ProjectTasks/${id}`);
};

export const useTasks = () =>
    useQuery({
        queryKey: ["tasks"],
        queryFn: fetchTasks,
    });

    export const useAddTask = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: addTask,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        });
    };

    export const useUpdateTask = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: ({ id, task }: { id: number; task: { name: string; status: string } }) =>
                updateTask(id, task),
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        });
    };

    export const useDeleteTask = () => {
        const queryClient = useQueryClient();
        return useMutation({
            mutationFn: deleteTask,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        });
    };