using Microsoft.AspNetCore.Identity;

namespace ProjectApi.Models;

public class ApplicationUser : IdentityUser
{
	public bool NotificationsEnabled { get; set; } = true;
}






