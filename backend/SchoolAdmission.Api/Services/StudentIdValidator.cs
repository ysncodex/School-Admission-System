using System.Text.RegularExpressions;
using SchoolAdmission.Api.Infrastructure;

namespace SchoolAdmission.Api.Services;

public static partial class StudentIdValidator
{
    [GeneratedRegex("^[0-9]{17}$", RegexOptions.CultureInvariant)]
    private static partial Regex StudentIdPattern();

    public static string Validate(string? studentId)
    {
        if (string.IsNullOrWhiteSpace(studentId) || !StudentIdPattern().IsMatch(studentId))
        {
            throw ApiException.BadRequest("X-Student-Id is required and must contain exactly 17 digits.");
        }

        return studentId;
    }
}
