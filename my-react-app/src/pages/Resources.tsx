import EntityPage from "../components/EntityPage";

export default function Resources() {
  return <EntityPage title="Resources" endpoint="/Resources" idKey="resourceId" fields={[{ key: "projectId", label: "Project", type: "number" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "cost", label: "Cost", type: "number" }, { key: "availability", label: "Available", type: "boolean", options: ["true", "false"] }]} columns={[
    { key: "projectId", label: "Project" },
    { key: "name", label: "Name" },
    { key: "type", label: "Type" },
    { key: "cost", label: "Cost" },
    { key: "availability", label: "Available" },
  ]} />;
}
