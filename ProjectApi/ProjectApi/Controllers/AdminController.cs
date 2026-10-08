using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ProjectApi.Services;
using ProjectApi.Data;

[ApiController]
[Route("api/admin")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly EmailOtpService _emailOtpService;
    private readonly OrganizationAdminService _organizationAdminService;
    private readonly AppDbContext _context;

    public AdminController(UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager, EmailOtpService emailOtpService, OrganizationAdminService organizationAdminService, AppDbContext context)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _emailOtpService = emailOtpService;
        _organizationAdminService = organizationAdminService;
        _context = context;
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        if (!HasTrustedAdminRole()) return Forbid();

        var users = new List<object>();
        foreach (var user in _userManager.Users.ToList())
        {
            users.Add(new
            {
                Id = user.Id,
                UserName = user.UserName ?? user.Email ?? string.Empty,
                Email = user.Email ?? string.Empty,
                Roles = await _userManager.GetRolesAsync(user),
                Source = "identity"
            });
        }

        try
        {
            users.AddRange(await _organizationAdminService.GetSupabaseUsersAsync());
        }
        catch (InvalidOperationException exception)
        {
            return Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException exception)
        {
            return Problem(exception.Message, statusCode: (int?)exception.StatusCode ?? StatusCodes.Status502BadGateway);
        }

        return Ok(users);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(CreateAdminUserDto dto)
    {
        if (!HasTrustedAdminRole()) return Forbid();
        if (!IsAllowedRole(dto.Role)) return BadRequest("Role must be user, admin, or superadmin.");
        if (IsPrivilegedRole(dto.Role) && !HasTrustedSuperAdminRole())
            return Forbid();
        await EnsureRoleExists(dto.Role);
        var user = new ApplicationUser { UserName = dto.Username.Trim(), Email = dto.Email.Trim(), EmailConfirmed = !dto.Username.Equals("superadmin", StringComparison.OrdinalIgnoreCase) };
        var result = await _userManager.CreateAsync(user, dto.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);
        var roleResult = await _userManager.AddToRoleAsync(user, dto.Role.ToLowerInvariant());
        if (!roleResult.Succeeded) return BadRequest(roleResult.Errors);
        _context.Employees.Add(new Employee { Name = user.UserName ?? dto.Username, Role = dto.Role, ContactInfo = user.Email ?? dto.Email, UserId = user.Id });
        await _context.SaveChangesAsync();
        _organizationAdminService.AddAudit(User.Identity?.Name ?? "admin", "user.created", user.UserName ?? dto.Username);
        if (HasTrustedSuperAdminRole() && dto.Username.Equals("superadmin", StringComparison.OrdinalIgnoreCase)) await _emailOtpService.SendAsync(user);
        return Ok(new { user.Id, user.UserName, user.Email, Role = dto.Role.ToLowerInvariant() });
    }

    [HttpPut("users/{id}/role")]
    public async Task<IActionResult> UpdateUserRole(string id, UpdateUserRoleDto dto)
    {
        if (!HasTrustedAdminRole()) return Forbid();
        if (!IsAllowedRole(dto.Role)) return BadRequest("Role must be user, admin, or superadmin.");
        if (IsPrivilegedRole(dto.Role) && !HasTrustedSuperAdminRole()) return Forbid();
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            try
            {
                await _organizationAdminService.UpdateSupabaseUserRoleAsync(
                    id,
                    dto.Role,
                    User.Identity?.Name ?? "admin",
                    HasTrustedSuperAdminRole());
                var supabaseEmployee = await _context.Employees.FirstOrDefaultAsync(item => item.UserId == id);
                if (supabaseEmployee is not null)
                {
                    supabaseEmployee.Role = dto.Role.ToLowerInvariant();
                    await _context.SaveChangesAsync();
                }

                return Ok(new { Id = id, Role = dto.Role.ToLowerInvariant(), Source = "supabase" });
            }
            catch (InvalidOperationException exception)
            {
                return Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (HttpRequestException exception)
            {
                return Problem(exception.Message, statusCode: (int?)exception.StatusCode ?? StatusCodes.Status502BadGateway);
            }
        }

        await EnsureRoleExists(dto.Role);
        var currentUser = await GetCurrentUser();
        if (currentUser?.Id == user.Id && !string.Equals(dto.Role, "superadmin", StringComparison.OrdinalIgnoreCase))
            return BadRequest("You cannot remove your own superadmin access.");
        var currentRoles = await _userManager.GetRolesAsync(user);
        if (currentRoles.Any(IsPrivilegedRole) && !HasTrustedSuperAdminRole()) return Forbid();
        var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
        if (!removeResult.Succeeded) return BadRequest(removeResult.Errors);
        var addResult = await _userManager.AddToRoleAsync(user, dto.Role.ToLowerInvariant());
        if (!addResult.Succeeded) return BadRequest(addResult.Errors);
        var employee = await _context.Employees.FirstOrDefaultAsync(item => item.UserId == user.Id);
        if (employee is not null)
        {
            employee.Role = dto.Role.ToLowerInvariant();
            await _context.SaveChangesAsync();
        }
        _organizationAdminService.AddAudit(User.Identity?.Name ?? "admin", "user.role.updated", user.UserName ?? id);
        return Ok(new { user.Id, user.UserName, Role = dto.Role.ToLowerInvariant() });
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        if (!HasTrustedAdminRole()) return Forbid();

        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            if (string.Equals(User.FindFirstValue(JwtRegisteredClaimNames.Sub), id, StringComparison.Ordinal))
                return BadRequest("You cannot delete your own account.");

            try
            {
                await _organizationAdminService.DeleteSupabaseUserAsync(
                    id,
                    User.Identity?.Name ?? "admin",
                    HasTrustedSuperAdminRole());
                var supabaseEmployee = await _context.Employees.FirstOrDefaultAsync(item => item.UserId == id);
                if (supabaseEmployee is not null)
                {
                    _context.Employees.Remove(supabaseEmployee);
                    await _context.SaveChangesAsync();
                }

                return NoContent();
            }
            catch (InvalidOperationException exception)
            {
                return Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (HttpRequestException exception)
            {
                return Problem(exception.Message, statusCode: (int?)exception.StatusCode ?? StatusCodes.Status502BadGateway);
            }
        }

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Any(IsPrivilegedRole) && !HasTrustedSuperAdminRole()) return Forbid();
        var currentUser = await GetCurrentUser();
        if (currentUser?.Id == user.Id) return BadRequest("You cannot delete your own superadmin account.");

        await using var transaction = await _context.Database.BeginTransactionAsync();
        var employee = await _context.Employees.FirstOrDefaultAsync(item => item.UserId == user.Id);
        if (employee is not null) _context.Employees.Remove(employee);
        var result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            await transaction.RollbackAsync();
            return BadRequest(result.Errors);
        }

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
        _organizationAdminService.AddAudit(User.Identity?.Name ?? "admin", "user.deleted", user.UserName ?? id);
        return NoContent();
    }

    [HttpPost("invitations")]
    public async Task<IActionResult> CreateInvitation(CreateInvitationDto dto)
    {
        if (!HasTrustedAdminRole()) return Forbid();
        if (!IsAllowedRole(dto.Role)) return BadRequest("Role must be user, admin, or superadmin.");
        if (IsPrivilegedRole(dto.Role) && !HasTrustedSuperAdminRole()) return Forbid();

        try
        {
            var invitation = await _organizationAdminService.InviteAsync(
                dto.Email.Trim(),
                dto.Role.ToLowerInvariant(),
                User.Identity?.Name ?? "admin");
            return Ok(invitation);
        }
        catch (InvalidOperationException exception)
        {
            return Problem(exception.Message, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException exception)
        {
            return Problem(exception.Message, statusCode: (int?)exception.StatusCode ?? StatusCodes.Status502BadGateway);
        }
    }

    [HttpGet("invitations")]
    public IActionResult GetInvitations()
    {
        if (!HasTrustedAdminRole()) return Forbid();
        return Ok(_organizationAdminService.GetInvitations());
    }

    [HttpGet("audit")]
    public IActionResult GetAudit()
    {
        if (!HasTrustedAdminRole()) return Forbid();
        return Ok(_organizationAdminService.GetAuditEntries());
    }

    [HttpGet("account")]
    public async Task<IActionResult> GetAccount()
    {
        if (!HasTrustedAdminRole()) return Forbid();
        var user = await GetCurrentUser();
        return user is null ? NotFound() : Ok(new { user.UserName, user.Email });
    }

    [HttpPut("account")]
    public async Task<IActionResult> UpdateAccount(UpdateAdminAccountDto dto)
    {
        if (!HasTrustedAdminRole()) return Forbid();

        var user = await GetCurrentUser();
        if (user is null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.CurrentPassword)) return BadRequest("Current password is required.");

        if (!await _userManager.CheckPasswordAsync(user, dto.CurrentPassword))
            return BadRequest("Current password is incorrect.");

        if (!string.IsNullOrWhiteSpace(dto.NewPassword))
        {
            var passwordResult = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
            if (!passwordResult.Succeeded) return BadRequest(passwordResult.Errors);
        }

        return Ok(new { user.UserName, user.Email });
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

    private bool HasTrustedAdminRole()
    {
        var role = User.FindFirstValue("trusted_admin_role");
        return !string.IsNullOrWhiteSpace(role)
            && (role.Equals("admin", StringComparison.OrdinalIgnoreCase)
                || role.Equals("superadmin", StringComparison.OrdinalIgnoreCase));
    }

    private bool HasTrustedSuperAdminRole() =>
        string.Equals(User.FindFirstValue("trusted_admin_role"), "superadmin", StringComparison.OrdinalIgnoreCase);

    private static bool IsAllowedRole(string role) => role.Equals("user", StringComparison.OrdinalIgnoreCase)
        || role.Equals("admin", StringComparison.OrdinalIgnoreCase)
        || role.Equals("superadmin", StringComparison.OrdinalIgnoreCase);

    private static bool IsPrivilegedRole(string role) =>
        role.Equals("admin", StringComparison.OrdinalIgnoreCase)
        || role.Equals("superadmin", StringComparison.OrdinalIgnoreCase);

    private async Task EnsureRoleExists(string role)
    {
        var normalizedRole = role.ToLowerInvariant();
        if (!await _roleManager.RoleExistsAsync(normalizedRole))
        {
            var result = await _roleManager.CreateAsync(new IdentityRole(normalizedRole));
            if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
        }
    }
}

public sealed class UpdateAdminAccountDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string? NewPassword { get; set; }
}

public sealed class CreateAdminUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
}

public sealed class UpdateUserRoleDto
{
    public string Role { get; set; } = "user";
}

public sealed class CreateInvitationDto
{
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
}