using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Defines application-controlled limits for inline avatar submissions.
    /// </summary>
    public sealed class RestApiAvatarUploadOptions
    {
        /// <summary>
        /// Gets or sets the maximum decoded content length in bytes.
        /// </summary>
        public int MaxBytes { get; set; } = 4 * 1024 * 1024;

        /// <summary>
        /// Gets the allowed media types and their storage extensions.
        /// </summary>
        public IDictionary<string, string> Formats { get; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/png"] = ".png", ["image/jpeg"] = ".jpg", ["image/gif"] = ".gif", ["image/webp"] = ".webp"
        };
    }

    /// <summary>
    /// Carries decoded data without trusting a submitted filename as a storage path.
    /// </summary>
    /// <param name="Content">The decoded bytes.</param>
    /// <param name="MediaType">The declared and allowed media type.</param>
    /// <param name="Extension">The configured storage extension.</param>
    /// <param name="Fingerprint">The full SHA-256 fingerprint.</param>
    public sealed record RestApiAvatarUpload(byte[] Content, string MediaType, string Extension, string Fingerprint);

    /// <summary>
    /// Separates avatar validation from application storage and public addressing.
    /// </summary>
    public static class RestApiCrudFormDataAvatarExtensions
    {
        /// <summary>
        /// Detaches and validates an inline avatar before ordinary property binding.
        /// </summary>
        /// <param name="fields">The submitted payload.</param>
        /// <param name="name">The avatar field name.</param>
        /// <param name="options">The allowed size and formats.</param>
        /// <param name="validation">The validation result receiving field-specific errors.</param>
        /// <returns>The missing, removal, upload or invalid state.</returns>
        public static RestApiFormField<RestApiAvatarUpload> DetachAvatar(this RestApiCrudFormData fields, string name,
            RestApiAvatarUploadOptions options, IRestApiValidationResult validation)
        {
            ArgumentNullException.ThrowIfNull(options);
            ArgumentNullException.ThrowIfNull(validation);
            if (options.MaxBytes <= 0) throw new ArgumentOutOfRangeException(nameof(options));
            var field = fields.Detach<string>(name);
            if (field.State is RestApiFormFieldState.Missing or RestApiFormFieldState.Empty) return new(field.State);
            try
            {
                if (field.State == RestApiFormFieldState.Invalid) throw new FormatException(field.Error);
                var value = field.Value.Trim();
                if (value.Length > 4L * ((options.MaxBytes + 2L) / 3) + 4096) throw new FormatException("Avatar exceeds the configured size limit.");
                if (value.StartsWith("file:", StringComparison.OrdinalIgnoreCase))
                {
                    var separator = value.IndexOf(";data:", StringComparison.OrdinalIgnoreCase);
                    if (separator < 0) throw new FormatException("Avatar file prefix must be followed by a data URL.");
                    value = value[(separator + 1)..];
                }
                var comma = value.IndexOf(',');
                if (!value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) || comma < 5 ||
                    !value[..comma].EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
                    throw new FormatException("Avatar must contain a base64 data URL.");
                var mediaType = value[5..(comma - 7)];
                if (!options.Formats.TryGetValue(mediaType, out var extension)) throw new FormatException("Avatar media type is not allowed.");
                var content = Convert.FromBase64String(value[(comma + 1)..]);
                if (content.Length == 0 || content.Length > options.MaxBytes) throw new FormatException("Avatar is empty or exceeds the configured size limit.");
                return new(RestApiFormFieldState.Valid, new(content, mediaType, extension, Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant()));
            }
            catch (FormatException exception)
            {
                validation.Add(exception.Message, name);
                return new(RestApiFormFieldState.Invalid, Error: exception.Message);
            }
        }

        /// <summary>
        /// Applies a validated update through application-owned storage and address factories.
        /// </summary>
        /// <typeparam name="TStored">The application's storage handle type.</typeparam>
        /// <typeparam name="TImage">The application's public image type.</typeparam>
        /// <param name="field">The validated avatar field.</param>
        /// <param name="current">The existing image.</param>
        /// <param name="store">Stores a new upload and returns its handle.</param>
        /// <param name="publicImage">Resolves the stored handle to a public image.</param>
        /// <param name="remove">Removes the existing image when explicitly cleared.</param>
        /// <param name="fallback">Creates the replacement image after removal.</param>
        /// <returns>The image to assign to the application record.</returns>
        public static TImage ResolveAvatar<TStored, TImage>(this RestApiFormField<RestApiAvatarUpload> field,
            TImage current, Func<RestApiAvatarUpload, TStored> store, Func<TStored, TImage> publicImage,
            Action remove, Func<TImage> fallback)
        {
            ArgumentNullException.ThrowIfNull(field);
            if (field.State == RestApiFormFieldState.Missing) return current;
            if (field.State == RestApiFormFieldState.Invalid) throw new InvalidOperationException(field.Error);
            if (field.State == RestApiFormFieldState.Empty)
            {
                remove?.Invoke();
                return fallback is null ? default : fallback();
            }
            ArgumentNullException.ThrowIfNull(store);
            ArgumentNullException.ThrowIfNull(publicImage);
            return publicImage(store(field.Value));
        }
    }
}
