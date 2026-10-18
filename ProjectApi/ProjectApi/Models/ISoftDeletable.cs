namespace ProjectApi.Models;

public interface ISoftDeletable
{
    bool IsDeleted { get; set; }
    DateTime? DeletedAt { get; set; }
    Guid? DeletionGroupId { get; set; }
}
