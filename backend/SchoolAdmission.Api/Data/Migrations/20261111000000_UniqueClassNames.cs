using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Api.Data;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(SchoolAdmissionDbContext))]
[Migration("20261111000000_UniqueClassNames")]
public sealed class UniqueClassNames : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Classes_Name",
            table: "Classes");

        migrationBuilder.Sql(
            "CREATE UNIQUE INDEX \"UX_Classes_Name\" ON \"Classes\" (LOWER(\"Name\"));");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "UX_Classes_Name",
            table: "Classes");

        migrationBuilder.CreateIndex(
            name: "IX_Classes_Name",
            table: "Classes",
            column: "Name");
    }
}
