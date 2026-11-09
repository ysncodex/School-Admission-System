namespace SchoolAdmission.Api.Domain;

public sealed class AdmissionApplication
{
    public string Id { get; set; } = $"h_{Guid.NewGuid():N}";
    public string ClassId { get; set; } = string.Empty;
    public AdmissionClass? Class { get; set; }
    public string StudentId { get; set; } = string.Empty;
    public ApplicationStatus Status { get; set; } = ApplicationStatus.HELD;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
}

public enum ApplicationStatus
{
    HELD,
    CONFIRMED,
    EXPIRED,
    CANCELLED
}
