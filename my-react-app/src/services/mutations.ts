import { gql } from "@apollo/client";

export const ADD_TASK = gql`
  mutation AddTask($name: String!, $status: String!) {
  addTask(name: $name, status: $status) {
    id 
    name
    status 
  }
  }
`;

export const UPDATE_TASK = gql`
 mutation UpdateTask($id: Int!, $name: String!, $status: String!) {
 updateTask(id: $id, name: $name, status: $status) {
    id
    name 
    status 
 }
}
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: Int!) {
  deleteTask(id: $id)
}
`;