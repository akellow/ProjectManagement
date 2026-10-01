using HotChocolate;
using HotChocolate.Data;
using HotChocolate.Types;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;



public class Query
{
        [UsePaging]
        [UseFiltering]
        [UseSorting]
       public IQueryable<ProjectTask> GetProjectTasks([Service]AppDbContext context)
       {
        return context.ProjectTasks.AsQueryable();
       }
        public async Task<List<ProjectTask>> GetTasksByIdsAsync(
                [Service] AppDbContext context,
                List<int> ids
        )

        {
                return await context.ProjectTasks
                .Where(t => ids.Contains(t.ProjectTaskId))
                .ToListAsync();
        }

        public async Task<List<ProjectTask>> SearchTaskAsync(
                [Service] AppDbContext context,
                string keyword
        )
        {
                return await context.ProjectTasks
                     .Where(t => EF.Functions.Like(t.Title, $"%{keyword}%"))
                     .ToListAsync();
        }
        
    
}