using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ProjectApi.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ProjectApi.Services;
using ProjectApi.Data;

[Route("api/[controller]")]
[ApiController]

public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _config;
    private readonly EmailOtpService _emailOtpService;
    private readonly AppDbContext _context;

    public AuthController(UserManager<ApplicationUser> userManager, IConfiguration config, EmailOtpService emailOtpService, AppDbContext context)
    {
        _userManager = userManager;
        _config = config;
        _emailOtpService = emailOtpService;
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var user = new ApplicationUser { UserName = dto.UserName, Email = dto.Email, EmailConfirmed = false };
        var result = await _userManager.CreateAsync(user, dto.Password);

        if (result.Succeeded)
        {
            _context.Employees.Add(new Employee { Name = dto.UserName.Trim(), Role = "User", ContactInfo = dto.Email.Trim(), UserId = user.Id });
            await _context.SaveChangesAsync();
            if (!IsSuperAdmin(user.UserName))
            {
                user.EmailConfirmed = true;
                await _userManager.UpdateAsync(user);
                return Ok(new { message = "User registered successfully." });
            }

            try
            {
                await _emailOtpService.SendAsync(user);
            }
            catch (InvalidOperationException exception)
            {
                var employee = await _context.Employees.FirstOrDefaultAsync(item => item.UserId == user.Id);
                if (employee is not null) _context.Employees.Remove(employee);
                await _userManager.DeleteAsync(user);
                await _context.SaveChangesAsync();
                return BadRequest(exception.Message);
            }
            return Ok(new { message = "User registered successfully. Check your email for the verification code." });
        }

        return BadRequest(result.Errors);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _userManager.FindByNameAsync(dto.Username);
        if (user != null && await _userManager.CheckPasswordAsync(user, dto.Password))
        {
            if (!user.EmailConfirmed && IsSuperAdmin(user.UserName))
            {
                await _emailOtpService.SendAsync(user);
                return StatusCode(403, new { requiresEmailVerification = true, username = user.UserName, message = "A verification code was sent to your email." });
            }
            var token = await GenerateJwtToken(user);
            var refreshToken = Guid.NewGuid().ToString();

            return Ok(new { token, refreshToken });
        }
        return Unauthorized();
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailDto dto)
    {
        var user = await _userManager.FindByNameAsync(dto.Username);
        if (user is null || !IsSuperAdmin(user.UserName) || !_emailOtpService.Verify(user, dto.Code, "login")) return BadRequest("Invalid or expired verification code.");
        user.EmailConfirmed = true;
        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded) return BadRequest(result.Errors);
        _emailOtpService.Remove(user, "login");
        return Ok(new { message = "Email verified. You can now sign in." });
    }

    [HttpPost("refresh")]
    public IActionResult Refresh([FromBody] RefreshDto dto)
    {
        var userName = "demoUser";
        var user = new ApplicationUser { UserName = userName};

        var newToken = GenerateJwtToken(user).GetAwaiter().GetResult();
        return Ok(new { token = newToken });
    }

    private async Task<string> GenerateJwtToken(ApplicationUser user)
    {
        var userName = user.UserName
            ?? throw new InvalidOperationException("The user name is required to create a token.");
        var issuer = _config["Jwt:Issuer"]
            ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
        var audience = _config["Jwt:Audience"]
            ?? throw new InvalidOperationException("Jwt:Audience is not configured.");
        var key = _config["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");

        var roles = await _userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault() ?? "user";

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userName),
            new Claim("role", role),
            new Claim(ClaimTypes.Role, role)
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddHours(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private bool IsSuperAdmin(string? username) => string.Equals(username, _config["Jwt:SuperAdminUsername"], StringComparison.OrdinalIgnoreCase);
}

public sealed class VerifyEmailDto
{
    public string Username { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}