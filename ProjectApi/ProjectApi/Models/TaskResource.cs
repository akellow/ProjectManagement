namespace ProjectApi.Models;
public class TaskResource {
    public int TaskResourceId { get; set; }
    public int TaskId { get; set; }
    public int ResourceId { get; set; }
    public int Quantity { get; set; }

    public ProjectTask? Task { get; set; }
    public Resource? Resource { get; set; }
}