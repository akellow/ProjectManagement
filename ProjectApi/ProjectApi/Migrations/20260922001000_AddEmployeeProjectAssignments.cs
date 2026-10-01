using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectApi.Migrations
{
    public partial class AddEmployeeProjectAssignments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "UserId", table: "Employees", type: "text", nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectEmployees",
                columns: table => new
                {
                    ProjectEmployeeId = table.Column<int>(type: "integer", nullable: false).Annotation("Npgsql:ValueGenerationStrategy", Npgsql.EntityFrameworkCore.PostgreSQL.Metadata.NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProjectId = table.Column<int>(type: "integer", nullable: false),
                    EmployeeId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectEmployees", x => x.ProjectEmployeeId);
                    table.ForeignKey("FK_ProjectEmployees_Employees_EmployeeId", x => x.EmployeeId, "Employees", "EmployeeId", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_ProjectEmployees_Projects_ProjectId", x => x.ProjectId, "Projects", "ProjectId", onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_ProjectEmployees_EmployeeId", table: "ProjectEmployees", column: "EmployeeId");
            migrationBuilder.CreateIndex(name: "IX_ProjectEmployees_ProjectId_EmployeeId", table: "ProjectEmployees", columns: new[] { "ProjectId", "EmployeeId" }, unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ProjectEmployees");
            migrationBuilder.DropColumn(name: "UserId", table: "Employees");
        }
    }
}
