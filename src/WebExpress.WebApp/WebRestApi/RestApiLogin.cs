using System;
using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using WebExpress.WebCore;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides the base implementation for a login REST API endpoint that
    /// validates user credentials and tracks failed login attempts.
    /// </summary>
    public abstract class RestApiLogin : IRestApi
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        /// <summary>
        /// Gets the maximum number of failed attempts allowed before a delay
        /// is imposed. Defaults to 3.
        /// </summary>
        protected virtual int MaxFailedAttempts => 3;

        /// <summary>
        /// Gets the delay in seconds imposed after exceeding the maximum
        /// number of failed attempts. Defaults to 30 seconds.
        /// </summary>
        protected virtual int LockoutDelaySeconds => 30;

        /// <summary>
        /// Tracks failed login attempts per user.
        /// </summary>
        private static readonly ConcurrentDictionary<string, FailedAttemptInfo> FailedAttempts = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Processes a login request containing user credentials.
        /// </summary>
        /// <param name="request">The request containing the login data.</param>
        /// <returns>The response containing the authentication result.</returns>
        [Method(RequestMethod.POST)]
        public virtual IResponse Authenticate(IRequest request)
        {
            string username = null;
            string password = null;

            try
            {
                if (request.Content is byte[] bytes && bytes.Length > 0)
                {
                    var json = Encoding.UTF8.GetString(bytes);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    username = root.TryGetProperty("username", out var u) ? u.GetString() : null;
                    password = root.TryGetProperty("password", out var p) ? p.GetString() : null;
                }
            }
            catch (JsonException)
            {
                return new RestApiLoginResult
                {
                    Success = false,
                    Message = "Invalid request format."
                }.ToResponse();
            }

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return new RestApiLoginResult
                {
                    Success = false,
                    Message = "Username and password are required."
                }.ToResponse();
            }

            // check if the user is currently locked out
            var normalizedUser = username.Trim();
            if (IsLockedOut(normalizedUser, out var remainingSeconds))
            {
                return new RestApiLoginResult
                {
                    Success = false,
                    Message = $"Too many failed attempts. Please try again in {remainingSeconds} seconds.",
                    RetryAfter = remainingSeconds
                }.ToResponse();
            }

            // validate credentials
            var identity = ValidateCredentials(normalizedUser, password);

            if (identity is not null)
            {
                // clear failed attempts on successful login
                FailedAttempts.TryRemove(normalizedUser, out _);

                var token = GenerateToken(identity, request);

                return new RestApiLoginResult
                {
                    Success = true,
                    Token = token,
                    Message = "Authentication successful."
                }.ToResponse();
            }

            // record failed attempt
            RecordFailedAttempt(normalizedUser);

            // check if locked out after this attempt
            if (IsLockedOut(normalizedUser, out var retryAfter))
            {
                return new RestApiLoginResult
                {
                    Success = false,
                    Message = $"Too many failed attempts. Please try again in {retryAfter} seconds.",
                    RetryAfter = retryAfter
                }.ToResponse();
            }

            return new RestApiLoginResult
            {
                Success = false,
                Message = "Invalid username or password."
            }.ToResponse();
        }

        /// <summary>
        /// Validates the provided credentials against the identity store.
        /// </summary>
        /// <param name="username">The username to validate.</param>
        /// <param name="password">The password to validate.</param>
        /// <returns>The authenticated identity if valid; otherwise, null.</returns>
        protected abstract IIdentity ValidateCredentials(string username, string password);

        /// <summary>
        /// Generates an authentication token for the given identity.
        /// </summary>
        /// <param name="identity">The authenticated identity.</param>
        /// <param name="request">The original request.</param>
        /// <returns>A token string, or null if token-based auth is not used.</returns>
        protected virtual string GenerateToken(IIdentity identity, IRequest request)
        {
            return null;
        }

        /// <summary>
        /// Checks whether a user is currently locked out due to excessive failed attempts.
        /// </summary>
        /// <param name="username">The username to check.</param>
        /// <param name="remainingSeconds">The number of seconds remaining in the lockout period.</param>
        /// <returns>True if locked out; otherwise, false.</returns>
        private bool IsLockedOut(string username, out int remainingSeconds)
        {
            remainingSeconds = 0;

            if (!FailedAttempts.TryGetValue(username, out var info))
            {
                return false;
            }

            if (info.Count <= MaxFailedAttempts)
            {
                return false;
            }

            var elapsed = DateTime.UtcNow - info.LastAttempt;
            if (elapsed.TotalSeconds >= LockoutDelaySeconds)
            {
                // lockout period has expired, reset
                FailedAttempts.TryRemove(username, out _);
                return false;
            }

            remainingSeconds = (int)Math.Ceiling(LockoutDelaySeconds - elapsed.TotalSeconds);
            return true;
        }

        /// <summary>
        /// Records a failed login attempt for the specified user.
        /// </summary>
        /// <param name="username">The username for which the attempt failed.</param>
        private void RecordFailedAttempt(string username)
        {
            FailedAttempts.AddOrUpdate(
                username,
                _ => new FailedAttemptInfo { Count = 1, LastAttempt = DateTime.UtcNow },
                (_, existing) =>
                {
                    existing.Count++;
                    existing.LastAttempt = DateTime.UtcNow;
                    return existing;
                }
            );
        }

        /// <summary>
        /// Stores information about failed login attempts for a user.
        /// </summary>
        private class FailedAttemptInfo
        {
            /// <summary>
            /// Gets or sets the number of failed attempts.
            /// </summary>
            public int Count { get; set; }

            /// <summary>
            /// Gets or sets the timestamp of the last failed attempt.
            /// </summary>
            public DateTime LastAttempt { get; set; }
        }
    }
}
