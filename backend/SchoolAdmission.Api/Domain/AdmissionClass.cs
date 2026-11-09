namespace SchoolAdmission.Api.Domain;

public sealed class AdmissionClass
{
    public string Id { get; set; } = $"c_{Guid.NewGuid():N}";
    public string Name { get; set; } = string.Empty;
    public int TotalSeats { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<AdmissionApplication> Applications { get; set; } = new List<AdmissionApplication>();
}
