# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the project file
COPY ProjectApi/ProjectApi/ProjectApi.csproj ./ProjectApi/
COPY ProjectApi/ProjectApi.Infrastructure/ProjectApi.Infrastructure.csproj ./ProjectApi.Infrastructure/

# Restore dependencies
WORKDIR /src/ProjectApi
RUN dotnet restore

# Copy the rest of the source code
COPY ProjectApi/ProjectApi ./

# Build the project
RUN dotnet publish -c Release -o /app/out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Copy the published output from the build stage
COPY --from=build /app/out .

# Expose the port (Render will set PORT env var)
EXPOSE 5000

# Set the entry point
ENTRYPOINT ["dotnet", "ProjectApi.dll"]
