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
        /// Gets the maximum number of failed attempts allowed before the account is hard-locked.
        /// Defaults to 5.
        /// </summary>
        protected virtual int PermanentLockoutAttempts => 5;

        /// <summary>
        /// Gets how long, in seconds, an account stays hard-locked after reaching
        /// <see cref="PermanentLockoutAttempts"/>, and equally the idle span after which any
        /// lockout state is forgotten. Defaults to one hour.
        /// </summary>
        /// <remarks>
        /// The previous hard lock had no way back short of a restart. Bounding it means an
        /// account unlocks itself once the attacker gives up, which is the automatic half of the
        /// unlock story; <see cref="ResetFailedAttempts"/> is the manual half, for an
        /// administrator who wants to clear a lock at once.
        /// </remarks>
        protected virtual int PermanentLockoutDurationSeconds => 60 * 60;

        /// <summary>
        /// Tracks failed login attempts, keyed by application and user so a lockout is confined
        /// to the application (tenant) it happened in rather than shared across every application
        /// in the process. Static because a fresh endpoint instance handles each request, so the
        /// counters have to outlive the instance.
        /// </summary>
        private static readonly ConcurrentDictionary<string, RestApiSessionFailedAttemptInfo> FailedAttempts = new(StringComparer.Ordinal);

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

                    // a document that parses but has the wrong shape - an array at the root,
                    // a number where the name belongs - is as much a format error as one that
                    // does not parse; the readers would throw on it, and only the parse is
                    // covered by the catch below
                    if (root.ValueKind != JsonValueKind.Object
                        || !TryReadString(root, "username", out username)
                        || !TryReadString(root, "password", out password))
                    {
                        return FormatError(request);
                    }
                }
            }
            catch (JsonException)
            {
                return FormatError(request);
            }

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return new RestApiSessionResult
                {
                    Success = false,
                    Message = I18N.Translate(request, "webexpress.webapp:login.error.empty")
                }.ToResponse();
            }

            // check if the user is currently locked out
            var normalizedUser = username.Trim();
            if (IsLockedOut(request, normalizedUser, out var remainingSeconds))
            {
                if (remainingSeconds == -1)
                {
                    // handle permanent lockout
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate(request, "webexpress.webapp:login.error.locked")
                    }.ToResponse();
                }
                else
                {
                    // handle temporary exponential lockout
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate(request, "webexpress.webapp:login.error.retryafter", remainingSeconds),
                        RetryAfter = remainingSeconds
                    }.ToResponse();
                }
            }

            // validate credentials
            var identity = ValidateCredentials(normalizedUser, password);

            if (identity is not null)
            {
                // clear failed attempts on successful login
                ResetFailedAttempts(request, normalizedUser);

                var tokens = EstablishIdentity(identity, request);

                // valid credentials are not enough: if credentials could not be issued the
                // client has nothing to authenticate later requests with, so this is a login
                // failure, not a success with missing credentials
                if (tokens is null)
                {
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate(request, "webexpress.webapp:login.error.session")
                    }.ToResponse();
                }

                return new RestApiSessionResult
                {
                    Success = true,
                    SessionId = null,
                    Message = I18N.Translate(request, "webexpress.webapp:login.success")
                }.ToResponse();
            }

            // record failed attempt
            RecordFailedAttempt(request, normalizedUser);

            // check if locked out after this attempt
            if (IsLockedOut(request, normalizedUser, out var retryAfter))
            {
                if (retryAfter == -1)
                {
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate(request, "webexpress.webapp:login.error.locked")
                    }.ToResponse();
                }
                else
                {
                    return new RestApiSessionResult
                    {
                        Success = false,
                        Message = I18N.Translate(request, "webexpress.webapp:login.error.ratelimit"),
                        RetryAfter = retryAfter
                    }.ToResponse();
                }
            }

            return new RestApiSessionResult
            {
                Success = false,
                Message = I18N.Translate(request, "webexpress.webapp:login.error.invalid")
            }.ToResponse();
        }

        /// <summary>
        /// Reads one credential from the login document.
        /// </summary>
        /// <remarks>
        /// A missing or null property is not an error here: the caller reports empty
        /// credentials, which is the message a user who left a field blank should get. A
        /// property of another type is, because it cannot be what the client sends and
        /// reading it as a string would throw.
        /// </remarks>
        /// <param name="root">The document's root object.</param>
        /// <param name="name">The property name.</param>
        /// <param name="value">The credential, or null when the property is absent or null.</param>
        /// <returns><see langword="true"/> when the property is absent, null or a string.</returns>
        private static bool TryReadString(JsonElement root, string name, out string value)
        {
            value = null;

            if (!root.TryGetProperty(name, out var property) || property.ValueKind == JsonValueKind.Null)
            {
                return true;
            }

            if (property.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            value = property.GetString();

            return true;
        }

        /// <summary>
        /// Builds the response for a login document the endpoint cannot read.
        /// </summary>
        /// <param name="request">The request whose language determines the error message.</param>
        /// <returns>The failure response.</returns>
        private static IResponse FormatError(IRequest request)
        {
            return new RestApiSessionResult
            {
                Success = false,
                Message = I18N.Translate(request, "webexpress.webapp:login.error.format")
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
                Message = I18N.Translate(request, "webexpress.webapp:logout.success")
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
        /// Issues the common token pair after a provider has verified the user credentials.
        /// </summary>
        /// <remarks>
        /// The identity manager queues protected cookies for the outgoing response. A failed issuance
        /// remains a login failure, and neither token is returned in the JSON response.
        /// </remarks>
        /// <param name="identity">The authenticated identity.</param>
        /// <param name="request">The original request.</param>
        /// <returns>The issued credentials, or null if authentication could not be established.</returns>
        protected virtual IdentityTokenPair EstablishIdentity(IIdentity identity, IRequest request)
        {
            return WebEx.ComponentHub.IdentityManager.Login(identity, request);
        }

        /// <summary>
        /// Revokes renewal and clears the authentication cookies for the given request.
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
        /// <param name="request">The request, used to scope the lockout to its application.</param>
        /// <param name="username">The username to check.</param>
        /// <param name="remainingSeconds">The number of seconds remaining, or -1 for a hard lockout.</param>
        /// <returns>True if locked out; otherwise, false.</returns>
        private bool IsLockedOut(IRequest request, string username, out int remainingSeconds)
        {
            remainingSeconds = 0;

            var key = LockoutKey(request, username);

            if (!FailedAttempts.TryGetValue(key, out var info))
            {
                return false;
            }

            // any lockout state, hard or throttled, is forgotten once the account has been left
            // alone for the full lockout duration - this is the automatic unlock, and it also
            // keeps the store from holding entries for accounts no one is attacking any more
            if ((DateTime.UtcNow - info.LastAttempt).TotalSeconds >= PermanentLockoutDurationSeconds)
            {
                FailedAttempts.TryRemove(key, out _);
                return false;
            }

            // hard-lock the account once it reaches the ceiling, until the duration above lapses
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
        /// <param name="request">The request, used to scope the attempt to its application.</param>
        /// <param name="username">The username for which the attempt failed.</param>
        private void RecordFailedAttempt(IRequest request, string username)
        {
            FailedAttempts.AddOrUpdate(
                LockoutKey(request, username),
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

        /// <summary>
        /// Clears the failed-attempt record for a user, lifting any lockout at once.
        /// </summary>
        /// <remarks>
        /// Called on a successful login and available to a derived administrative endpoint as the
        /// manual counterpart to the time-based unlock, so a locked-out account need not wait out
        /// <see cref="PermanentLockoutDurationSeconds"/>.
        /// </remarks>
        /// <param name="request">The request, used to scope the reset to its application.</param>
        /// <param name="username">The username to unlock.</param>
        protected void ResetFailedAttempts(IRequest request, string username)
        {
            FailedAttempts.TryRemove(LockoutKey(request, username), out _);
        }

        /// <summary>
        /// Builds the store key that scopes a lockout to one application and user.
        /// </summary>
        /// <remarks>
        /// The username is lower-cased so the lockout is case-insensitive in the user while the
        /// application id, which is case-sensitive, stays intact; a newline separates the two so
        /// no application id and username can run together into another pair's key.
        /// </remarks>
        /// <param name="request">The request whose application scopes the key.</param>
        /// <param name="username">The username.</param>
        /// <returns>The composite key.</returns>
        private static string LockoutKey(IRequest request, string username)
        {
            var scope = request?.ApplicationContext?.ApplicationId ?? string.Empty;

            return scope + "\n" + (username ?? string.Empty).ToLowerInvariant();
        }
    }
}
