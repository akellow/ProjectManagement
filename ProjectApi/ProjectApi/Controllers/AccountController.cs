using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ProjectApi.Models;
using ProjectApi.Services;

[ApiController]
[Route("api/account")]
[Authorize(Policy = "AdminOnly")]
public class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly EmailOtpService _emailOtpService;

    public AccountController(UserManager<ApplicationUser> userManager, EmailOtpService emailOtpService)
    {
        _userManager = userManager;
        _emailOtpService = emailOtpService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAccount()
    {
        var user = await GetCurrentUser();
        return user is null ? NotFound() : Ok(new { user.UserName, user.Email, user.EmailConfirmed, user.NotificationsEnabled });
    }

    [HttpPut("notifications")]
    public async Task<IActionResult> UpdateNotificationSettings(UpdateNotificationSettingsDto dto)
    {
        var user = await GetCurrentUser();
        if (user is null) return NotFound();
        user.NotificationsEnabled = dto.Enabled;
        await _userManager.UpdateAsync(user);
        return Ok(new { user.NotificationsEnabled });
    }

    [HttpPost("email/request")]
    public async Task<IActionResult> RequestEmailChange(ChangeEmailRequestDto dto)
    {
        var user = await GetCurrentUser();
        if (user is null) return NotFound();
        var email = dto.Email.Trim();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return BadRequest("A valid email is required.");
        if (!await _userManager.CheckPasswordAsync(user, dto.CurrentPassword)) return BadRequest("Current password is incorrect.");
        if (string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase)) return BadRequest("Enter a different email address.");

        var existing = await _userManager.FindByEmailAsync(email);
        if (existing is not null && existing.Id != user.Id) return BadRequest("That email address is already in use.");
        if (!string.Equals(User.FindFirstValue("trusted_admin_role"), "superadmin", StringComparison.OrdinalIgnoreCase))
        {
            var directResult = await _userManager.SetEmailAsync(user, email);
            if (!directResult.Succeeded) return BadRequest(directResult.Errors);
            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);
            return Ok(new { user.UserName, user.Email, user.EmailConfirmed, requiresVerification = false });
        }
        try
        {
            await _emailOtpService.SendAsync(user, email, "email-change");
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
        return Ok(new { message = "A verification code was sent to the new email address." });
    }

    [HttpPost("email/confirm")]
    public async Task<IActionResult> ConfirmEmailChange(ConfirmEmailChangeDto dto)
    {
        var user = await GetCurrentUser();
        if (user is null) return NotFound();
        var email = dto.Email.Trim();
        if (!_emailOtpService.Verify(user, dto.Code.Trim(), "email-change", email)) return BadRequest("Invalid or expired verification code.");
        var result = await _userManager.SetEmailAsync(user, email);
        if (!result.Succeeded) return BadRequest(result.Errors);
        user.EmailConfirmed = true;
        await _userManager.UpdateAsync(user);
        _emailOtpService.Remove(user, "email-change");
        return Ok(new { user.UserName, user.Email, user.EmailConfirmed });
    }

    private async Task<ApplicationUser?> GetCurrentUser()
    {
        var subject = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!string.IsNullOrWhiteSpace(subject))
        {
            var userById = await _userManager.FindByIdAsync(subject);
            if (userById is not null) return userById;
        }

        var username = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.Identity?.Name
            ?? subject;
        return username is null ? null : await _userManager.FindByNameAsync(username);
    }
}

public sealed class ChangeEmailRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string CurrentPassword { get; set; } = string.Empty;
}

public sealed class ConfirmEmailChangeDto
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public sealed class UpdateNotificationSettingsDto
{
    public bool Enabled { get; set; }
}
