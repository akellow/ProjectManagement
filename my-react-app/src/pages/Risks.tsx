import EntityPage from "../components/EntityPage";

export default function Risks() {
  return <EntityPage title="Risks" endpoint="/Risks" idKey="riskId" fields={[{ key: "projectId", label: "Project", type: "number" }, { key: "description", label: "Description" }, { key: "probability", label: "Probability", type: "riskProbability", options: ["Low", "High"] }, { key: "impact", label: "Impact", options: ["Low", "Medium", "High"] }, { key: "mitigationPlan", label: "Mitigation" }]} columns={[
    { key: "description", label: "Description" },
    { key: "projectId", label: "Project" },
    { key: "probability", label: "Probability" },
    { key: "impact", label: "Impact" },
    { key: "mitigationPlan", label: "Mitigation" },
  ]} />;
}
