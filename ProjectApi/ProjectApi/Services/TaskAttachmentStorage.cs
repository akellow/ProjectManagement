using Path = System.IO.Path;

namespace ProjectApi.Services;

public class TaskAttachmentStorage
{
    public const long MaximumFileSize = 10 * 1024 * 1024;
    private readonly string _storageDirectory;
    private static readonly IReadOnlyDictionary<string, string> AllowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
        [".txt"] = "text/plain",
        [".csv"] = "text/csv",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };

    public TaskAttachmentStorage(IWebHostEnvironment environment, IConfiguration configuration)
    {
        var configuredPath = configuration["TaskAttachments:StoragePath"];
        var storagePath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(environment.ContentRootPath, "App_Data", "task-attachments")
            : Path.IsPathRooted(configuredPath) ? configuredPath : Path.Combine(environment.ContentRootPath, configuredPath);
        _storageDirectory = Path.GetFullPath(storagePath);
        Directory.CreateDirectory(_storageDirectory);
    }

    public string GetContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName);
        return AllowedTypes.TryGetValue(extension, out var contentType)
            ? contentType
            : throw new InvalidOperationException("This file type is not supported.");
    }

    public async Task<string> SaveAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaximumFileSize)
            throw new InvalidOperationException("Attachments must be no larger than 10 MB.");

        _ = GetContentType(file.FileName);
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var storageName = $"{Guid.NewGuid():N}{extension}";
        var destination = GetPath(storageName);
        try
        {
            await using var stream = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true);
            await file.CopyToAsync(stream, cancellationToken);
            return storageName;
        }
        catch
        {
            await DeleteAsync(storageName, CancellationToken.None);
            throw;
        }
    }

    public FileStream OpenRead(string storageName) =>
        new(GetPath(storageName), FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

    public Task DeleteAsync(string storageName, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var path = GetPath(storageName);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string GetPath(string storageName)
    {
        if (Path.GetFileName(storageName) != storageName || storageName.Contains("..", StringComparison.Ordinal))
            throw new InvalidOperationException("Invalid attachment storage key.");
        var path = Path.GetFullPath(Path.Combine(_storageDirectory, storageName));
        var storageRoot = Path.EndsInDirectorySeparator(_storageDirectory)
            ? _storageDirectory
            : _storageDirectory + Path.DirectorySeparatorChar;
        if (!path.StartsWith(storageRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Invalid attachment storage key.");
        return path;
    }
}
