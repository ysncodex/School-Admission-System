using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Data;

public sealed class SchoolAdmissionDbContext(DbContextOptions<SchoolAdmissionDbContext> options)
    : DbContext(options)
{
    public DbSet<AdmissionClass> Classes => Set<AdmissionClass>();
    public DbSet<AdmissionApplication> Applications => Set<AdmissionApplication>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var classes = modelBuilder.Entity<AdmissionClass>();
        classes.ToTable("Classes");
        classes.HasKey(x => x.Id);
        classes.Property(x => x.Id).HasMaxLength(40);
        classes.Property(x => x.Name).HasMaxLength(100).IsRequired();
        classes.Property(x => x.TotalSeats).IsRequired();
        classes.Property(x => x.CreatedAt).IsRequired();
        classes.HasIndex(x => x.Name)
            .IsUnique()
            .HasDatabaseName("UX_Classes_Name");

        var applications = modelBuilder.Entity<AdmissionApplication>();
        applications.ToTable("Applications");
        applications.HasKey(x => x.Id);
        applications.Property(x => x.Id).HasMaxLength(40);
        applications.Property(x => x.ClassId).HasMaxLength(40).IsRequired();
        applications.Property(x => x.StudentId).HasMaxLength(17).IsRequired();
        applications.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        applications.Property(x => x.CreatedAt).IsRequired();
        applications.Property(x => x.ExpiresAt).IsRequired();
        applications.HasOne(x => x.Class)
            .WithMany(x => x.Applications)
            .HasForeignKey(x => x.ClassId)
            .OnDelete(DeleteBehavior.Restrict);
        applications.HasIndex(x => new { x.ClassId, x.Status, x.ExpiresAt });
        applications.HasIndex(x => new { x.StudentId, x.CreatedAt });
        applications.HasIndex(x => new { x.ClassId, x.StudentId })
            .IsUnique()
            .HasDatabaseName("UX_Applications_OneActivePerStudentClass")
            .HasFilter("\"Status\" IN ('HELD', 'CONFIRMED')");
    }
}
