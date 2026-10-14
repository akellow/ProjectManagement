using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectApi.Data;

#nullable disable

namespace ProjectApi.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20261014140000_AddEmployeeNotifications")]
    public partial class AddEmployeeNotifications : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_AspNetUsers_UserId",
                table: "Notifications");

            migrationBuilder.AddColumn<bool>(
                name: "NotificationsEnabled",
                table: "Employees",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotificationsEnabled",
                table: "Employees");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_AspNetUsers_UserId",
                table: "Notifications",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
