using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Caching.Memory;
using ProjectApi.Models;

namespace ProjectApi.Services;

public sealed class EmailOtpService
{
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailOtpService> _logger;

    public EmailOtpService(IMemoryCache cache, IConfiguration configuration, ILogger<EmailOtpService> logger)
    {
        _cache = cache;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(ApplicationUser user, string? recipient = null, string purpose = "login")
    {
        var code = Random.Shared.Next(100000, 1000000).ToString();
        var destination = recipient ?? user.Email ?? throw new InvalidOperationException("A recipient email is required.");
        _cache.Set(CacheKey(user.UserName!, purpose), new OtpData(code, destination), TimeSpan.FromMinutes(10));

        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogWarning("Email OTP for {Username}: {Code}. Configure Smtp settings to send real email.", user.UserName, code);
            return;
        }

        var username = _configuration["Smtp:Username"];
        var password = _configuration["Smtp:Password"];
        var from = _configuration["Smtp:From"] ?? username;
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(from))
        {
            throw new InvalidOperationException("Smtp:Username, Smtp:Password, and Smtp:From must be configured for Gmail OTP delivery.");
        }

        using var client = new SmtpClient(host, int.Parse(_configuration["Smtp:Port"] ?? "587"))
        {
            EnableSsl = bool.Parse(_configuration["Smtp:EnableSsl"] ?? "true"),
            Credentials = new NetworkCredential(username, password)
        };
        using var message = new MailMessage(from, destination, "Project Manager email verification", $"Your verification code is {code}. It expires in 10 minutes.");
        await client.SendMailAsync(message);
    }

    public bool Verify(ApplicationUser user, string code, string purpose = "login", string? recipient = null)
        => _cache.TryGetValue(CacheKey(user.UserName!, purpose), out OtpData? expected)
            && expected is not null
            && expected.Code == code
            && (recipient is null || string.Equals(expected.Recipient, recipient, StringComparison.OrdinalIgnoreCase));

    public void Remove(ApplicationUser user, string purpose = "login") => _cache.Remove(CacheKey(user.UserName!, purpose));

    private static string CacheKey(string username, string purpose) => $"email-otp:{purpose}:{username.ToLowerInvariant()}";

    private sealed record OtpData(string Code, string Recipient);
}
