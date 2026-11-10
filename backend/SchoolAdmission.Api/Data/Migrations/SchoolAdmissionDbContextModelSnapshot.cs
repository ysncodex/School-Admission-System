using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using SchoolAdmission.Api.Domain;

#nullable disable

namespace SchoolAdmission.Api.Data.Migrations;

[DbContext(typeof(SchoolAdmissionDbContext))]
public sealed class SchoolAdmissionDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasAnnotation("ProductVersion", "10.0.14")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        modelBuilder.Entity<AdmissionClass>(entity =>
        {
            entity.ToTable("Classes");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasMaxLength(40).HasColumnType("character varying(40)");
            entity.Property(x => x.Name).IsRequired().HasMaxLength(100).HasColumnType("character varying(100)");
            entity.Property(x => x.TotalSeats).HasColumnType("integer");
            entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            entity.HasIndex(x => x.Name)
                .IsUnique()
                .HasDatabaseName("UX_Classes_Name");
        });

        modelBuilder.Entity<AdmissionApplication>(entity =>
        {
            entity.ToTable("Applications");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasMaxLength(40).HasColumnType("character varying(40)");
            entity.Property(x => x.ClassId).IsRequired().HasMaxLength(40).HasColumnType("character varying(40)");
            entity.Property(x => x.StudentId).IsRequired().HasMaxLength(17).HasColumnType("character varying(17)");
            entity.Property(x => x.Status).HasConversion<string>().IsRequired().HasMaxLength(16).HasColumnType("character varying(16)");
            entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
            entity.Property(x => x.ExpiresAt).HasColumnType("timestamp with time zone");
            entity.Property(x => x.ConfirmedAt).HasColumnType("timestamp with time zone");
            entity.HasIndex(x => new { x.ClassId, x.Status, x.ExpiresAt });
            entity.HasIndex(x => new { x.StudentId, x.CreatedAt });
            entity.HasIndex(x => new { x.ClassId, x.StudentId })
                .IsUnique()
                .HasDatabaseName("UX_Applications_OneActivePerStudentClass")
                .HasFilter("\"Status\" IN ('HELD', 'CONFIRMED')");
            entity.HasOne(x => x.Class)
                .WithMany(x => x.Applications)
                .HasForeignKey(x => x.ClassId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();
        });
    }
}
