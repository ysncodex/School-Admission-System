using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Api.Data;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(SchoolAdmissionDbContext))]
[Migration("20261109000000_InitialCreate")]
public sealed class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Classes",
            columns: table => new
            {
                Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                TotalSeats = table.Column<int>(type: "integer", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_Classes", x => x.Id));

        migrationBuilder.CreateTable(
            name: "Applications",
            columns: table => new
            {
                Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                ClassId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                StudentId = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: false),
                Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ConfirmedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Applications", x => x.Id);
                table.ForeignKey(
                    name: "FK_Applications_Classes_ClassId",
                    column: x => x.ClassId,
                    principalTable: "Classes",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Classes_Name",
            table: "Classes",
            column: "Name");

        migrationBuilder.CreateIndex(
            name: "IX_Applications_ClassId_Status_ExpiresAt",
            table: "Applications",
            columns: new[] { "ClassId", "Status", "ExpiresAt" });

        migrationBuilder.CreateIndex(
            name: "IX_Applications_StudentId_CreatedAt",
            table: "Applications",
            columns: new[] { "StudentId", "CreatedAt" });

        migrationBuilder.CreateIndex(
            name: "UX_Applications_OneActivePerStudentClass",
            table: "Applications",
            columns: new[] { "ClassId", "StudentId" },
            unique: true,
            filter: "\"Status\" IN ('HELD', 'CONFIRMED')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Applications");
        migrationBuilder.DropTable(name: "Classes");
    }
}
