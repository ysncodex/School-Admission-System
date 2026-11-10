using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Domain;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Services;

public sealed class AdmissionService(
    SchoolAdmissionDbContext db,
    IConfiguration configuration,
    TimeProvider timeProvider)
{
    private int HoldDurationSeconds
    {
        get
        {
            var configured = configuration["HOLD_DURATION_SECONDS"];
            return int.TryParse(configured, out var seconds) && seconds > 0
                ? Math.Clamp(seconds, 1, 86_400)
                : 600;
        }
    }

    public async Task<CreatedClassResponse> CreateClassAsync(CreateClassRequest request, CancellationToken ct)
    {
        var normalizedName = request.Name.Trim();
        if (normalizedName.Length < 3)
            throw ApiException.BadRequest("Class name must contain at least 3 characters.");
        if (request.TotalSeats < 1 || request.TotalSeats > 100_000)
            throw ApiException.BadRequest("Total seats must be between 1 and 100,000.");
        if (await db.Classes.AnyAsync(x => x.Name.ToLower() == normalizedName.ToLower(), ct))
            throw ApiException.Conflict($"A class or shift named \"{normalizedName}\" already exists.");

        var entity = new AdmissionClass
        {
            Name = normalizedName,
            TotalSeats = request.TotalSeats,
            CreatedAt = timeProvider.GetUtcNow()
        };

        db.Classes.Add(entity);
        await db.SaveChangesAsync(ct);
        return new CreatedClassResponse(entity.Id, entity.Name, entity.TotalSeats);
    }

    public async Task<IReadOnlyList<ClassResponse>> GetClassesAsync(CancellationToken ct)
    {
        await ExpireStaleHoldsAsync(ct);
        var now = timeProvider.GetUtcNow();
        var classes = await db.Classes.AsNoTracking().OrderBy(x => x.CreatedAt).ToListAsync(ct);
        var counts = await db.Applications.AsNoTracking()
            .Where(x => x.Status == ApplicationStatus.CONFIRMED ||
                        (x.Status == ApplicationStatus.HELD && x.ExpiresAt > now))
            .GroupBy(x => new { x.ClassId, x.Status })
            .Select(group => new { group.Key.ClassId, group.Key.Status, Count = group.Count() })
            .ToListAsync(ct);

        var countLookup = counts.ToLookup(x => x.ClassId);
        return classes.Select(item =>
        {
            var held = countLookup[item.Id]
                .Where(x => x.Status == ApplicationStatus.HELD).Sum(x => x.Count);
            var confirmed = countLookup[item.Id]
                .Where(x => x.Status == ApplicationStatus.CONFIRMED).Sum(x => x.Count);
            return new ClassResponse(item.Id, item.Name, item.TotalSeats, held, confirmed,
                Math.Max(0, item.TotalSeats - held - confirmed));
        }).ToList();
    }

    public async Task<ClassResponse> GetClassAsync(string classId, CancellationToken ct)
    {
        await ExpireStaleHoldsAsync(ct);
        var item = await db.Classes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == classId, ct)
            ?? throw ApiException.NotFound("Class was not found.");
        var now = timeProvider.GetUtcNow();
        var held = await db.Applications.CountAsync(x => x.ClassId == classId &&
            x.Status == ApplicationStatus.HELD && x.ExpiresAt > now, ct);
        var confirmed = await db.Applications.CountAsync(x => x.ClassId == classId &&
            x.Status == ApplicationStatus.CONFIRMED, ct);
        return new ClassResponse(item.Id, item.Name, item.TotalSeats, held, confirmed,
            Math.Max(0, item.TotalSeats - held - confirmed));
    }

    public async Task<HoldResponse> CreateHoldAsync(string classId, string studentId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        var admissionClass = await LockClassRowAsync(classId, ct);
        if (admissionClass is null)
            throw ApiException.NotFound("Class was not found.");

        var now = timeProvider.GetUtcNow();
        await ExpireClassHoldsAsync(classId, now, ct);

        var existing = await db.Applications.AsNoTracking().AnyAsync(x =>
            x.ClassId == classId && x.StudentId == studentId &&
            (x.Status == ApplicationStatus.CONFIRMED || x.Status == ApplicationStatus.HELD), ct);
        if (existing)
            throw ApiException.Conflict(
                "You already have a reservation or confirmed admission for this class. Open My applications to review it.");

        var usedSeats = await db.Applications.CountAsync(x => x.ClassId == classId &&
            (x.Status == ApplicationStatus.CONFIRMED || x.Status == ApplicationStatus.HELD), ct);
        if (usedSeats >= admissionClass.TotalSeats)
            throw ApiException.Conflict("No seats are currently available in this class.");

        var hold = new AdmissionApplication
        {
            ClassId = classId,
            StudentId = studentId,
            Status = ApplicationStatus.HELD,
            CreatedAt = now,
            ExpiresAt = now.AddSeconds(HoldDurationSeconds)
        };

        db.Applications.Add(hold);
        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw ApiException.Conflict(
                "You already have a reservation or confirmed admission for this class. Open My applications to review it.");
        }

        return new HoldResponse(hold.Id, hold.ClassId, hold.StudentId,
            hold.Status.ToString(), hold.ExpiresAt);
    }

    public async Task<HoldStatusResponse> GetHoldAsync(string holdId, CancellationToken ct)
    {
        var hold = await db.Applications.SingleOrDefaultAsync(x => x.Id == holdId, ct)
            ?? throw ApiException.NotFound("Application was not found.");

        if (hold.Status == ApplicationStatus.HELD && hold.ExpiresAt <= timeProvider.GetUtcNow())
        {
            hold.Status = ApplicationStatus.EXPIRED;
            await db.SaveChangesAsync(ct);
        }

        return new HoldStatusResponse(hold.Id, hold.ClassId, hold.Status.ToString(), hold.ExpiresAt);
    }

    public async Task<ConfirmResponse> ConfirmHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var classId = await db.Applications.AsNoTracking()
            .Where(x => x.Id == holdId).Select(x => x.ClassId).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Application was not found.");

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        if (await LockClassRowAsync(classId, ct) is null)
            throw ApiException.NotFound("Class was not found.");

        var hold = await db.Applications
            .FromSqlInterpolated($"SELECT * FROM \"Applications\" WHERE \"Id\" = {holdId} FOR UPDATE")
            .SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Application was not found.");

        EnsureOwner(hold, studentId);
        if (hold.Status == ApplicationStatus.CONFIRMED)
        {
            await transaction.CommitAsync(ct);
            return new ConfirmResponse(hold.Id, hold.Status.ToString());
        }

        if (hold.Status == ApplicationStatus.HELD && hold.ExpiresAt <= timeProvider.GetUtcNow())
        {
            hold.Status = ApplicationStatus.EXPIRED;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            throw ApiException.Conflict("This reservation has expired. Please apply again if seats are available.");
        }

        if (hold.Status != ApplicationStatus.HELD)
            throw ApiException.Conflict($"This application cannot be confirmed because its status is {hold.Status}.");

        hold.Status = ApplicationStatus.CONFIRMED;
        hold.ConfirmedAt = timeProvider.GetUtcNow();
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new ConfirmResponse(hold.Id, hold.Status.ToString());
    }

    public async Task CancelHoldAsync(string holdId, string studentId, CancellationToken ct)
    {
        var classId = await db.Applications.AsNoTracking()
            .Where(x => x.Id == holdId).Select(x => x.ClassId).SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Application was not found.");

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
        if (await LockClassRowAsync(classId, ct) is null)
            throw ApiException.NotFound("Class was not found.");

        var hold = await db.Applications
            .FromSqlInterpolated($"SELECT * FROM \"Applications\" WHERE \"Id\" = {holdId} FOR UPDATE")
            .SingleOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Application was not found.");
        EnsureOwner(hold, studentId);

        if (hold.Status == ApplicationStatus.HELD && hold.ExpiresAt <= timeProvider.GetUtcNow())
            hold.Status = ApplicationStatus.EXPIRED;
        else if (hold.Status == ApplicationStatus.HELD)
            hold.Status = ApplicationStatus.CANCELLED;
        else if (hold.Status == ApplicationStatus.CONFIRMED)
            throw ApiException.Conflict("A confirmed admission cannot be cancelled through this endpoint.");

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task<IReadOnlyList<StudentHoldResponse>> GetStudentHoldsAsync(string studentId, CancellationToken ct)
    {
        await ExpireStaleHoldsAsync(ct);
        var applications = await db.Applications.AsNoTracking()
            .Include(x => x.Class)
            .Where(x => x.StudentId == studentId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        return applications.Select(x => new StudentHoldResponse(
            x.Id, x.ClassId, x.Class?.Name ?? "Unknown class", x.Status.ToString(), x.ExpiresAt)).ToList();
    }

    public async Task<int> ExpireStaleHoldsAsync(CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow();
        return await db.Applications
            .Where(x => x.Status == ApplicationStatus.HELD && x.ExpiresAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, ApplicationStatus.EXPIRED), ct);
    }

    private async Task<AdmissionClass?> LockClassRowAsync(string classId, CancellationToken ct)
    {
        return await db.Classes
            .FromSqlInterpolated($"SELECT * FROM \"Classes\" WHERE \"Id\" = {classId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
    }

    private async Task ExpireClassHoldsAsync(string classId, DateTimeOffset now, CancellationToken ct)
    {
        await db.Applications
            .Where(x => x.ClassId == classId && x.Status == ApplicationStatus.HELD && x.ExpiresAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, ApplicationStatus.EXPIRED), ct);
    }

    private static void EnsureOwner(AdmissionApplication hold, string studentId)
    {
        if (!string.Equals(hold.StudentId, studentId, StringComparison.Ordinal))
            throw ApiException.NotFound("Application was not found for this student.");
    }
}
