using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace ProjectApi.Migrations
{
    /// <inheritdoc />
    public partial class AddTrashRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "TaskResources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "TaskResources",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "TaskResources",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Risks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Risks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Risks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Resources",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Resources",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Resources",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ProjectTasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "ProjectTasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "ProjectTasks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Projects",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "ProjectEmployees",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "ProjectEmployees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "ProjectEmployees",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Milestones",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Milestones",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Milestones",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Employees",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Employees",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Communications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Communications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Communications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Assignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeletionGroupId",
                table: "Assignments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Assignments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "TrashEntries",
                columns: table => new
                {
                    TrashEntryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EntityType = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<string>(type: "text", nullable: false),
                    DisplayName = table.Column<string>(type: "text", nullable: false),
                    DeletionGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrashEntries", x => x.TrashEntryId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TrashEntries_DeletionGroupId",
                table: "TrashEntries",
                column: "DeletionGroupId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TrashEntries");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "TaskResources");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "TaskResources");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "TaskResources");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Risks");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Resources");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "ProjectTasks");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "ProjectEmployees");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "ProjectEmployees");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "ProjectEmployees");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Milestones");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Employees");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Communications");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Communications");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Communications");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "DeletionGroupId",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Assignments");
        }
    }
}
