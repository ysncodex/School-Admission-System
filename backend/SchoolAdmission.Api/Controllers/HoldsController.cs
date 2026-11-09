using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("holds")]
public sealed class HoldsController(AdmissionService admissionService) : ControllerBase
{
    [HttpGet("{holdId}")]
    [ProducesResponseType<HoldStatusResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<HoldStatusResponse>> GetById(string holdId, CancellationToken ct)
        => Ok(await admissionService.GetHoldAsync(holdId, ct));

    [HttpPost("{holdId}/confirm")]
    [ProducesResponseType<ConfirmResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ConfirmResponse>> Confirm(string holdId, CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(Request.Headers["X-Student-Id"].FirstOrDefault());
        return Ok(await admissionService.ConfirmHoldAsync(holdId, studentId, ct));
    }

    [HttpDelete("{holdId}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Cancel(string holdId, CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(Request.Headers["X-Student-Id"].FirstOrDefault());
        await admissionService.CancelHoldAsync(holdId, studentId, ct);
        return NoContent();
    }
}
