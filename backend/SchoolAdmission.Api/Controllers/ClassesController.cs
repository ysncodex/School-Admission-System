using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Api.DTOs;
using SchoolAdmission.Api.Services;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public sealed class ClassesController(AdmissionService admissionService) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType<CreatedClassResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CreatedClassResponse>> Create(
        [FromBody] CreateClassRequest request, CancellationToken ct)
    {
        var result = await admissionService.CreateClassAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { classId = result.Id }, result);
    }

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ClassResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ClassResponse>>> GetAll(CancellationToken ct)
        => Ok(await admissionService.GetClassesAsync(ct));

    [HttpGet("{classId}")]
    [ProducesResponseType<ClassResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ClassResponse>> GetById(string classId, CancellationToken ct)
        => Ok(await admissionService.GetClassAsync(classId, ct));

    [HttpPost("{classId}/holds")]
    [ProducesResponseType<HoldResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<HoldResponse>> CreateHold(string classId, CancellationToken ct)
    {
        var studentId = StudentIdValidator.Validate(Request.Headers["X-Student-Id"].FirstOrDefault());
        var result = await admissionService.CreateHoldAsync(classId, studentId, ct);
        return CreatedAtAction(nameof(HoldsController.GetById), "Holds",
            new { holdId = result.HoldId }, result);
    }
}
