using System;
using System.Collections.Concurrent;
using System.Text.Json;
using WebExpress.WebCore;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebRestApi;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides the base implementation for a login REST API endpoint that
    /// validates user credentials, tracks failed login attempts with exponential backoff,
    /// and permanently locks accounts after a specific amount of failures.
    /// </summary>
    public abstract class RestApiSession : IRestApi
    {
        /// <summary>
        /// Gets the number of failed attempts after which the exponential time penalty starts.
        /// Defaults to 3.
        /// </summary>
        protected virtual int PenaltyStartAttempts => 3;

        /// <summary>
        /// Gets the base delay in seconds for the first time penalty.
        /// Defaults to 30 seconds.
        /// </summary>
        protected virtual int BaseLockoutDelaySeconds => 30;

        /// <summary>
        /// Gets the maximum number of failed attempts allowed before the account is permanently locked.
        /// Defaults to 5.
        /// </summary>
        protected virtual int PermanentLockoutAttempts => 5;

        /// <summary>
        /// Tracks failed login attempts per user.
        /// </summary>
        private static readonly ConcurrentDictionary<string, RestApiSessionFailedAttemptInfo> FailedAttempts = new(StringComparer.OrdinalIgnoreCase);

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
                var r = request as Request;

                if (r?.Content is byte[] bytes && bytes.Length > 0)
                {
                    using var doc = JsonDocument.Parse(bytes);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("username", out var u))
                    {
                        username = u.GetString();
                    }

                    if (root.TryGetProperty("password", out var p))
                    {
                        password = p.GetString();
                    }
                }
            }
            catch (JsonException)
            {
                return new RestApiSessionResult
                {
                    Success = false,
                    Message = I18N.Translate("webexpress.webapp:login.error.format")
                }.ToResponse();
            }

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return new RestApiSessionResult
                {
                    Success = false,
                    Message = I18N.Translate("webexpress.webapp:login.error.empty")
                }.ToResponse();
            }

            // check if the user is currently locked out
            var normalizedUser = username.Trim();
            if (IsLockedOut(normalizedUser, out var remainingSeconds))
            {
                if (remainingSeconds == -1)
                {
                    // handle permanent lockout
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate("webexpress.webapp:login.error.locked")
                    }.ToResponse();
                }
                else
                {
                    // handle temporary exponential lockout
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = string.Format(I18N.Translate("webexpress.webapp:login.error.retryafter"), remainingSeconds),
                        RetryAfter = remainingSeconds
                    }.ToResponse();
                }
            }

            // validate credentials
            var identity = ValidateCredentials(normalizedUser, password);

            if (identity is not null)
            {
                // clear failed attempts on successful login
                FailedAttempts.TryRemove(normalizedUser, out _);

                var sessinId = GenerateSession(identity, request);

                return new RestApiSessionResult
                {
                    Success = true,
                    SessionId = sessinId,
                    Message = I18N.Translate("webexpress.webapp:login.success")
                }.ToResponse();
            }

            // record failed attempt
            RecordFailedAttempt(normalizedUser);

            // check if locked out after this attempt
            if (IsLockedOut(normalizedUser, out var retryAfter))
            {
                if (retryAfter == -1)
                {
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate("webexpress.webapp:login.error.locked")
                    }.ToResponse();
                }
                else
                {
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate("webexpress.webapp:login.error.ratelimit"),
                        RetryAfter = retryAfter
                    }.ToResponse();
                }
            }

            return new RestApiSessionResult
            {
                Success = false,
                Message = I18N.Translate("webexpress.webapp:login.error.invalid")
            }.ToResponse();
        }

        /// <summary>
        /// Processes a logout request to invalidate the current session.
        /// </summary>
        /// <param name="request">The request containing the logout data.</param>
        /// <returns>The response containing the logout result.</returns>
        [Method(RequestMethod.DELETE)]
        public virtual IResponse Logout(IRequest request)
        {
            // invalidate the current session or token
            InvalidateSession(request);

            return new RestApiSessionResult
            {
                Success = true,
                Message = I18N.Translate("webexpress.webapp:logout.success")
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
        /// Generates an sessionId for the given identity.
        /// </summary>
        /// <param name="identity">The authenticated identity.</param>
        /// <param name="request">The original request.</param>
        /// <returns>A token string, or null if token-based auth is not used.</returns>
        protected virtual string GenerateSession(IIdentity identity, IRequest request)
        {
            return WebEx.ComponentHub.IdentityManager.Login(identity, request)?
                .Id.ToString();
        }

        /// <summary>
        /// Invalidates the authentication token or session for the given request.
        /// </summary>
        /// <param name="request">The original request.</param>
        protected virtual void InvalidateSession(IRequest request)
        {
            WebEx.ComponentHub.IdentityManager.Logout(request);
        }

        /// <summary>
        /// Checks whether a user is currently locked out due to excessive failed attempts
        /// and calculates the remaining penalty time using exponential backoff.
        /// </summary>
        /// <param name="username">The username to check.</param>
        /// <param name="remainingSeconds">The number of seconds remaining, or -1 for permanent lockout.</param>
        /// <returns>True if locked out; otherwise, false.</returns>
        private bool IsLockedOut(string username, out int remainingSeconds)
        {
            remainingSeconds = 0;

            if (!FailedAttempts.TryGetValue(username, out var info))
            {
                return false;
            }

            // permanently lock account if maximum attempts are reached
            if (info.Count >= PermanentLockoutAttempts)
            {
                remainingSeconds = -1;
                return true;
            }

            // no lockout if below penalty threshold
            if (info.Count < PenaltyStartAttempts)
            {
                return false;
            }

            // calculate exponential penalty: base * 2^(count - start)
            var penaltyMultiplier = Math.Pow(2, info.Count - PenaltyStartAttempts);
            var penaltySeconds = BaseLockoutDelaySeconds * (int)penaltyMultiplier;

            var elapsed = DateTime.UtcNow - info.LastAttempt;
            if (elapsed.TotalSeconds >= penaltySeconds)
            {
                // penalty time has passed, do not reset attempts completely to prevent brute force bursts,
                // but allow the next login attempt to proceed.
                return false;
            }

            // calculate remaining time
            remainingSeconds = (int)Math.Ceiling(penaltySeconds - elapsed.TotalSeconds);
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
                _ => new RestApiSessionFailedAttemptInfo { Count = 1, LastAttempt = DateTime.UtcNow },
                (_, existing) =>
                {
                    // return a new instance to ensure thread-safety
                    return new RestApiSessionFailedAttemptInfo
                    {
                        Count = existing.Count + 1,
                        LastAttempt = DateTime.UtcNow
                    };
                }
            );
        }
    }
}