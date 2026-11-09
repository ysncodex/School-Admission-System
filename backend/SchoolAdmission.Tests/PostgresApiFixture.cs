using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SchoolAdmission.Api.Data;
using Testcontainers.PostgreSql;
using Xunit;

namespace SchoolAdmission.Tests;

public sealed class PostgresApiFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .Build();

    public AdmissionApiFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Factory = new AdmissionApiFactory(_postgres.GetConnectionString());
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null)
            await Factory.DisposeAsync();
        await _postgres.DisposeAsync();
    }
}

public sealed class AdmissionApiFactory(
    string connectionString,
    int? holdDurationSeconds = null) : WebApplicationFactory<Program>
{
    public string ConnectionString => connectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        if (holdDurationSeconds is not null)
            builder.UseSetting("HOLD_DURATION_SECONDS", holdDurationSeconds.Value.ToString());
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<SchoolAdmissionDbContext>>();
            services.AddDbContext<SchoolAdmissionDbContext>(options => options.UseNpgsql(connectionString));
        });
    }
}
