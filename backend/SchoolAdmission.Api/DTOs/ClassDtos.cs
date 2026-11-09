using System.ComponentModel.DataAnnotations;

namespace SchoolAdmission.Api.DTOs;

public sealed class CreateClassRequest
{
    [Required, StringLength(100, MinimumLength = 3)]
    public string Name { get; init; } = string.Empty;

    [Range(1, 100_000)]
    public int TotalSeats { get; init; }
}

public sealed record ClassResponse(
    string Id,
    string Name,
    int TotalSeats,
    int HeldSeats,
    int ConfirmedSeats,
    int AvailableSeats);

public sealed record CreatedClassResponse(string Id, string Name, int TotalSeats);
