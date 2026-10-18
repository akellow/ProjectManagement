import EntityPage from "../components/EntityPage";

export default function Milestones() {
  return <EntityPage title="Milestones" endpoint="/Milestones" idKey="milestoneId" fields={[{ key: "projectId", label: "Project", type: "number" }, { key: "name", label: "Name" }, { key: "dueDate", label: "Due date (EAT)", type: "datetime-local" }, { key: "status", label: "Status", options: ["Pending", "In Progress", "Completed"] }]} columns={[
    { key: "name", label: "Name" },
    { key: "projectId", label: "Project" },
    { key: "dueDate", label: "Due date (EAT)" },
    { key: "status", label: "Status" },
  ]} />;
}
