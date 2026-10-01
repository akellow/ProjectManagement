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
        var user = await GetCurrentUser();
        if (user is null) return Unauthorized();
        return Ok(await _context.Notifications.Where(item => item.UserId == user.Id).OrderByDescending(item => item.CreatedAt).ToListAsync());
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var user = await GetCurrentUser();
        var notification = await _context.Notifications.FirstOrDefaultAsync(item => item.NotificationId == id && item.UserId == user!.Id);
        if (notification is null) return NotFound();
        notification.IsRead = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private Task<ApplicationUser?> GetCurrentUser()
    {
        var username = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.Identity?.Name;
        return username is null ? Task.FromResult<ApplicationUser?>(null) : _userManager.FindByNameAsync(username);
    }
}
