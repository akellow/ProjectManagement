using ProjectApi.Data;
using ProjectApi.Models;
using Microsoft.EntityFrameworkCore;

namespace ProjectApi.GraphQL
{
    public class Mutation
    {
        // Single Insert
        public async Task<ProjectTask> AddProjectTaskAsync(ProjectTask input, AppDbContext context)
        {
            context.ProjectTasks.Add(input);
            await context.SaveChangesAsync();
            return input;
        }

        // Bulk Insert
        public async Task<List<ProjectTask>> AddProjectTasksAsync(List<ProjectTask> inputs, AppDbContext context)
        {
            context.ProjectTasks.AddRange(inputs);
            await context.SaveChangesAsync();
            return inputs;
        }

        // Bulk Delete
        public async Task<int> DeleteProjectTasksAsync(List<int> ids, AppDbContext context)
        {
            var tasks = await context.ProjectTasks
                                     .Where(t => ids.Contains(t.ProjectTaskId))
                                     .ToListAsync();

            context.ProjectTasks.RemoveRange(tasks);
            return await context.SaveChangesAsync();
        }
    }
}
