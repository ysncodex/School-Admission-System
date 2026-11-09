using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("me")]
public sealed class MeController(AdmissionService admissionService) : ControllerBase
{
    [HttpGet("holds")]
    [ProducesResponseType<IReadOnlyList<StudentHoldResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<StudentHoldResponse>>> GetMyHolds(CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(Request.Headers["X-Student-Id"].FirstOrDefault());
        return Ok(await admissionService.GetStudentHoldsAsync(studentId, ct));
    }
}
