using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace SchoolAdmission.Api.Infrastructure;

public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ApiException exception)
        {
            await WriteErrorAsync(context, exception.StatusCode, exception.Message);
        }
        catch (BadHttpRequestException exception)
        {
            await WriteErrorAsync(context, StatusCodes.Status400BadRequest, exception.Message);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled request error for {Method} {Path}",
                context.Request.Method, context.Request.Path);

            if (exception is DbUpdateException { InnerException: PostgresException postgres } &&
                postgres.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                var detail = postgres.ConstraintName == "UX_Classes_Name"
                    ? "A class or shift with this name already exists."
                    : "You already have a reservation or confirmed admission for this class. Open My applications to review it.";
                await WriteErrorAsync(context, StatusCodes.Status409Conflict, detail);
                return;
            }

            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError,
                "An unexpected server error occurred. Please try again.");
        }
    }

    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string detail)
    {
        if (context.Response.HasStarted) return;

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json";
        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = ((HttpStatusCode)statusCode).ToString(),
            Detail = detail,
            Instance = context.Request.Path
        };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        await context.Response.WriteAsJsonAsync(problem);
    }
}
