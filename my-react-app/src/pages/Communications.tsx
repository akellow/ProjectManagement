import EntityPage from "../components/EntityPage";

export default function Communications() {
  return <EntityPage title="Communications" endpoint="/Communications" idKey="communicationId" fields={[{ key: "projectId", label: "Project", type: "number" }, { key: "employeeId", label: "Employee", type: "number" }, { key: "message", label: "Message" }, { key: "date", label: "Date", type: "datetime-local" }]} columns={[
    { key: "projectId", label: "Project" },
    { key: "employeeId", label: "Employee" },
    { key: "message", label: "Message" },
    { key: "date", label: "Date" },
  ]} />;
}
