using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using Microsoft.AspNetCore.Identity;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    public NotificationsController(AppDbContext context, UserManager<ApplicationUser> userManager) { _context = context; _userManager = userManager; }

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var userId = await GetCurrentUserId();
        if (userId is null) return Unauthorized();
        return Ok(await _context.Notifications.Where(item => item.UserId == userId).OrderByDescending(item => item.CreatedAt).ToListAsync());
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var userId = await GetCurrentUserId();
        if (userId is null) return Unauthorized();
        var notification = await _context.Notifications.FirstOrDefaultAsync(item => item.NotificationId == id && item.UserId == userId);
        if (notification is null) return NotFound();
        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> GetCurrentUserId()
    {
        var username = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(username)) return null;

        var identityUser = await _userManager.FindByIdAsync(username) ?? await _userManager.FindByNameAsync(username);
        if (identityUser is not null) return identityUser.Id;

        return await _context.Employees.AnyAsync(employee => employee.UserId == username)
            ? username
            : null;
    }
}
