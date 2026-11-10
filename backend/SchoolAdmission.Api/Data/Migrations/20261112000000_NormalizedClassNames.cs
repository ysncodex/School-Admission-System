using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Api.Data;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(SchoolAdmissionDbContext))]
[Migration("20261112000000_NormalizedClassNames")]
public sealed class NormalizedClassNames : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "NormalizedName",
            table: "Classes",
            type: "character varying(100)",
            maxLength: 100,
            nullable: false,
            computedColumnSql: "LOWER(\"Name\")",
            stored: true);

        migrationBuilder.DropIndex(
            name: "UX_Classes_Name",
            table: "Classes");

        migrationBuilder.CreateIndex(
            name: "UX_Classes_Name",
            table: "Classes",
            column: "NormalizedName",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "UX_Classes_Name",
            table: "Classes");

        migrationBuilder.DropColumn(
            name: "NormalizedName",
            table: "Classes");

        migrationBuilder.Sql(
            "CREATE UNIQUE INDEX \"UX_Classes_Name\" ON \"Classes\" (LOWER(\"Name\"));");
    }
}
