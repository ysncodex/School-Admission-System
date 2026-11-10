using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace SchoolAdmission.Tests;

public sealed class AdmissionApiTests(PostgresApiFixture fixture) : IClassFixture<PostgresApiFixture>
{
    [Fact]
    public async Task CreateClass_ReturnsTheRequiredClassContract()
    {
        using var client = fixture.Factory.CreateClient();
        var response = await client.PostAsJsonAsync("/classes", new
        {
            name = $"Class {Guid.NewGuid():N}"[..13],
            totalSeats = 12
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ClassCreatedDto>();
        Assert.NotNull(payload);
        Assert.StartsWith("c_", payload.Id);
        Assert.Equal(12, payload.TotalSeats);
    }

    [Fact]
    public async Task DuplicateClassName_ReturnsConflict()
    {
        using var client = fixture.Factory.CreateClient();
        const string className = "Class 8 - Morning Shift";

        var first = await client.PostAsJsonAsync("/classes", new
        {
            name = className,
            totalSeats = 12
        });
        var duplicate = await client.PostAsJsonAsync("/classes", new
        {
            name = "  class 8 - morning shift  ",
            totalSeats = 20
        });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    [Fact]
    public async Task Hold_CanBeConfirmedRepeatedlyWithoutDoubleCounting()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 2);
        var studentId = NewStudentId();

        var holdResponse = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", studentId);
        Assert.Equal(HttpStatusCode.Created, holdResponse.StatusCode);
        var hold = await holdResponse.Content.ReadFromJsonAsync<HoldCreatedDto>();
        Assert.NotNull(hold);

        var firstConfirm = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/holds/{hold.HoldId}/confirm", studentId);
        var secondConfirm = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/holds/{hold.HoldId}/confirm", studentId);
        Assert.Equal(HttpStatusCode.OK, firstConfirm.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondConfirm.StatusCode);

        var classResponse = await client.GetFromJsonAsync<ClassAvailabilityDto>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(1, classResponse.ConfirmedSeats);
        Assert.Equal(1, classResponse.AvailableSeats);
    }

    [Fact]
    public async Task ConcurrentApplications_NeverAllocateMoreThanCapacity()
    {
        using var client = fixture.Factory.CreateClient();
        const int capacity = 6;
        const int requestCount = 60;
        var classId = await CreateClassAsync(client, capacity);

        var requests = Enumerable.Range(0, requestCount).Select(async _ =>
        {
            var response = await SendStudentRequestAsync(client, HttpMethod.Post,
                $"/classes/{classId}/holds", NewStudentId());
            return response.StatusCode;
        });

        var results = await Task.WhenAll(requests);
        Assert.Equal(capacity, results.Count(status => status == HttpStatusCode.Created));
        Assert.Equal(requestCount - capacity, results.Count(status => status == HttpStatusCode.Conflict));

        var summary = await client.GetFromJsonAsync<ClassAvailabilityDto>($"/classes/{classId}");
        Assert.NotNull(summary);
        Assert.Equal(capacity, summary.HeldSeats + summary.ConfirmedSeats);
        Assert.InRange(summary.AvailableSeats, 0, capacity);
    }

    [Fact]
    public async Task StudentHeaderMustContainExactlySeventeenDigits()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 1);
        var response = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", "12345");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DuplicateActiveApplication_ReturnsConflict()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 2);
        var studentId = NewStudentId();

        var first = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", studentId);
        var second = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", studentId);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task FullClass_ReturnsConflict()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 1);

        var first = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", NewStudentId());
        var second = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", NewStudentId());

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task CancellingHold_ReleasesSeatForAnotherStudent()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 1);
        var firstStudent = NewStudentId();

        var holdResponse = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", firstStudent);
        var hold = await holdResponse.Content.ReadFromJsonAsync<HoldCreatedDto>();
        Assert.NotNull(hold);

        var cancelResponse = await SendStudentRequestAsync(client, HttpMethod.Delete,
            $"/holds/{hold.HoldId}", firstStudent);
        var nextHoldResponse = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", NewStudentId());

        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, nextHoldResponse.StatusCode);
    }

    [Fact]
    public async Task AnotherStudentCannotConfirmSomeoneElsesHold()
    {
        using var client = fixture.Factory.CreateClient();
        var classId = await CreateClassAsync(client, 1);
        var owner = NewStudentId();
        var holdResponse = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", owner);
        var hold = await holdResponse.Content.ReadFromJsonAsync<HoldCreatedDto>();
        Assert.NotNull(hold);

        var response = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/holds/{hold.HoldId}/confirm", NewStudentId());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredHold_CannotBeConfirmed()
    {
        await using var shortLivedFactory = new AdmissionApiFactory(
            fixture.Factory.ConnectionString,
            holdDurationSeconds: 1);
        using var client = shortLivedFactory.CreateClient();
        var classId = await CreateClassAsync(client, 1);
        var studentId = NewStudentId();
        var holdResponse = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/classes/{classId}/holds", studentId);
        var hold = await holdResponse.Content.ReadFromJsonAsync<HoldCreatedDto>();
        Assert.NotNull(hold);

        await Task.Delay(TimeSpan.FromSeconds(2));
        var response = await SendStudentRequestAsync(client, HttpMethod.Post,
            $"/holds/{hold.HoldId}/confirm", studentId);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task InvalidClassInput_ReturnsBadRequest()
    {
        using var client = fixture.Factory.CreateClient();
        var response = await client.PostAsJsonAsync("/classes", new
        {
            name = "A",
            totalSeats = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<string> CreateClassAsync(HttpClient client, int seats)
    {
        var response = await client.PostAsJsonAsync("/classes", new
        {
            name = $"Test Class {Guid.NewGuid():N}"[..20],
            totalSeats = seats
        });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<ClassCreatedDto>();
        return result!.Id;
    }

    private static async Task<HttpResponseMessage> SendStudentRequestAsync(
        HttpClient client, HttpMethod method, string path, string studentId)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-Student-Id", studentId);
        return await client.SendAsync(request);
    }

    private static string NewStudentId() => Random.Shared.NextInt64(10_000_000_000_000_000, 99_999_999_999_999_999)
        .ToString(System.Globalization.CultureInfo.InvariantCulture);

    private sealed record ClassCreatedDto(string Id, string Name, int TotalSeats);
    private sealed record HoldCreatedDto(string HoldId, string ClassId, string StudentId, string Status, DateTimeOffset ExpiresAt);
    private sealed record ClassAvailabilityDto(string Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);
}
