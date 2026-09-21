using Microsoft.Extensions.Configuration;
using System.Reflection;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebIdentity;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests the login REST API endpoint.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiLogin : IDisposable
    {
        private readonly string _tokenDirectory = Path.Combine(Path.GetTempPath(), "webexpress-login-" + Guid.NewGuid().ToString("N"));

        /// <summary>
        /// Supplies isolated deployment credentials for the WebApp login integration tests.
        /// </summary>
        /// <returns>The registered component hub with isolated authentication configuration.</returns>
        private WebExpress.WebCore.WebComponent.ComponentHub CreateAuthenticationHub()
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string>
            {
                ["WebExpress:Authentication:Issuer"] = "https://webapp.test",
                ["WebExpress:Authentication:Audience"] = "webapp-tests",
                ["WebExpress:Authentication:SigningKey"] = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)),
                ["WebExpress:Authentication:TokenStorePath"] = _tokenDirectory
            }).Build();
            return UnitTestControlFixture.CreateAndRegisterComponentHubMock(configuration);
        }

        /// <summary>
        /// Removes the isolated credential markers used by this test instance.
        /// </summary>
        public void Dispose()
        {
            if (Directory.Exists(_tokenDirectory)) { Directory.Delete(_tokenDirectory, true); }
        }
        /// <summary>
        /// Tests successful authentication.
        /// </summary>
        [Fact]
        public void AuthenticateSuccess()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateLoginRequest("admin", "password123");

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = ParseResponseJson(result);
            Assert.True(json.GetProperty("success").GetBoolean());
            Assert.Equal("You have signed in successfully.", json.GetProperty("message").GetString());
        }

        /// <summary>
        /// A successful login queues signed credentials while keeping them out of the response body.
        /// </summary>
        [Fact]
        public void AuthenticateSuccess_SignsInWithoutExposingSessionId()
        {
            // arrange
            var componentHub = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateLoginRequest("admin", "password123");

            // act
            var result = api.Authenticate(request);

            // assert
            var json = ParseResponseJson(result);
            Assert.True(json.GetProperty("success").GetBoolean());
            Assert.Equal(JsonValueKind.Null, json.GetProperty("sessionId").ValueKind);
            Assert.DoesNotContain(request.Session.Id.ToString(), Encoding.UTF8.GetString((byte[])result.Content));
            Assert.NotNull(componentHub.IdentityManager.GetCurrentIdentity(request));
        }

        /// <summary>
        /// Tests failed authentication with wrong password.
        /// </summary>
        [Fact]
        public void AuthenticateInvalidPassword()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateLoginRequest("admin", "wrongpassword");

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(401, result.Status);

            var json = ParseResponseJson(result);
            Assert.False(json.GetProperty("success").GetBoolean());
            Assert.Equal("Invalid username or password.", json.GetProperty("message").GetString());
        }

        /// <summary>
        /// Tests that empty credentials return an error.
        /// </summary>
        [Fact]
        public void AuthenticateEmptyCredentials()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateLoginRequest("", "");

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(401, result.Status);

            var json = ParseResponseJson(result);
            Assert.False(json.GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// Tests that lockout is triggered after exceeding maximum failed attempts.
        /// </summary>
        [Fact]
        public void AuthenticateLockout()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("lockout_user", "correct_password");

            // simulate 4 failed attempts (exceeds default max of 3)
            for (var i = 0; i < 4; i++)
            {
                var failedRequest = CreateLoginRequest("lockout_user", "wrong");
                api.Authenticate(failedRequest);
            }

            // act - the 5th attempt should be locked out
            var request = CreateLoginRequest("lockout_user", "correct_password");
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(400, result.Status);

            var json = ParseResponseJson(result);
            Assert.False(json.GetProperty("success").GetBoolean());
            Assert.True(json.GetProperty("retryAfter").GetInt32() > 0);
        }

        /// <summary>
        /// A document that parses but carries the credentials in the wrong shape is answered
        /// as a format error, the same as a document that does not parse - it must not escape
        /// as an exception from the reader.
        /// </summary>
        /// <param name="payload">The exact JSON body used to exercise credential input validation.</param>
        [Theory]
        [InlineData("{\"username\": 42, \"password\": \"password123\"}")]
        [InlineData("{\"username\": \"admin\", \"password\": [\"password123\"]}")]
        [InlineData("{\"username\": {\"name\": \"admin\"}, \"password\": \"password123\"}")]
        [InlineData("[\"admin\", \"password123\"]")]
        [InlineData("\"admin\"")]
        public void AuthenticateWrongShape_IsAFormatError(string payload)
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateRawLoginRequest(payload);

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(401, result.Status);

            var json = ParseResponseJson(result);
            Assert.False(json.GetProperty("success").GetBoolean());
            Assert.Equal("The login request could not be read.", json.GetProperty("message").GetString());
        }

        /// <summary>
        /// A credential that is null or missing is an empty credential, not a format error.
        /// </summary>
        /// <param name="payload">The exact JSON body used to exercise credential input validation.</param>
        [Theory]
        [InlineData("{\"username\": null, \"password\": \"password123\"}")]
        [InlineData("{\"password\": \"password123\"}")]
        public void AuthenticateNullOrMissingCredential_IsEmpty(string payload)
        {
            // arrange
            _ = CreateAuthenticationHub();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateRawLoginRequest(payload);

            // act
            var result = api.Authenticate(request);

            // assert
            var json = ParseResponseJson(result);
            Assert.False(json.GetProperty("success").GetBoolean());
            Assert.Equal("Username and password are required.", json.GetProperty("message").GetString());
        }

        /// <summary>
        /// Tests the login result for a successful response.
        /// </summary>
        [Fact]
        public void LoginResultSuccess()
        {
            // arrange
            var loginResult = new RestApiSessionResult
            {
                Success = true,
                SessionId = "test-token",
                Message = "OK"
            };

            // act
            var response = loginResult.ToResponse();

            // assert
            Assert.NotNull(response);
            Assert.Equal(200, response.Status);
        }

        /// <summary>
        /// Tests the login result for a failed response.
        /// </summary>
        [Fact]
        public void LoginResultFailure()
        {
            // arrange
            var loginResult = new RestApiSessionResult
            {
                Success = false,
                Message = "Invalid credentials"
            };

            // act
            var response = loginResult.ToResponse();

            // assert
            Assert.NotNull(response);
            Assert.Equal(401, response.Status);
        }

        /// <summary>
        /// Tests the login result for a rate-limited response.
        /// </summary>
        [Fact]
        public void LoginResultRateLimited()
        {
            // arrange
            var loginResult = new RestApiSessionResult
            {
                Success = false,
                Message = "Too many attempts",
                RetryAfter = 30
            };

            // act
            var response = loginResult.ToResponse();

            // assert
            Assert.NotNull(response);
            Assert.Equal(400, response.Status);
        }

        /// <summary>
        /// Valid credentials are not a successful login if the session cannot be established:
        /// the client would leave with nothing to authenticate later requests, so the response
        /// must report a failure rather than a success with no session.
        /// </summary>
        [Fact]
        public void Authenticate_SessionCreationFails_ReturnsLoginError()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123") { FailSessionCreation = true };
            var request = CreateLoginRequest(user, "password123");

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.Equal(401, result.Status);
            Assert.False(ParseResponseJson(result).GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// A lockout belongs to the application it happened in: hammering an account in one
        /// application must not lock the same account name in another (tenant isolation).
        /// </summary>
        [Fact]
        public void Lockout_IsScopedPerApplication()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123")
            {
                PenaltyStart = 100,
                PermanentAttempts = 3
            };

            // act - hard-lock the account in application "a"
            for (var i = 0; i < 3; i++)
            {
                api.Authenticate(CreateLoginRequest(user, "wrong", "a"));
            }

            var lockedInA = api.Authenticate(CreateLoginRequest(user, "password123", "a"));
            var inB = api.Authenticate(CreateLoginRequest(user, "password123", "b"));

            // assert
            Assert.False(ParseResponseJson(lockedInA).GetProperty("success").GetBoolean());
            Assert.True(ParseResponseJson(inB).GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// A hard lock holds within its window: once the ceiling is reached even correct
        /// credentials are refused, so an attacker cannot log in the moment they guess right.
        /// </summary>
        [Fact]
        public void Lockout_HardLocked_RefusesEvenCorrectCredentials()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123")
            {
                PenaltyStart = 100,
                PermanentAttempts = 3,
                PermanentDurationSeconds = 3600
            };

            // act
            for (var i = 0; i < 3; i++)
            {
                api.Authenticate(CreateLoginRequest(user, "wrong"));
            }

            var result = api.Authenticate(CreateLoginRequest(user, "password123"));

            // assert
            Assert.False(ParseResponseJson(result).GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// A hard lock is not forever: once its duration has lapsed the account can be used
        /// again, which is the automatic unlock the previous permanent lock lacked. Here the
        /// duration is zero, so the lock lifts on the next attempt without waiting.
        /// </summary>
        [Fact]
        public void Lockout_ExpiresAfterDuration()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var locking = new TestRestApiLogin(user, "password123")
            {
                PenaltyStart = 100,
                PermanentAttempts = 3,
                PermanentDurationSeconds = 3600
            };

            for (var i = 0; i < 3; i++)
            {
                locking.Authenticate(CreateLoginRequest(user, "wrong"));
            }

            Assert.False(ParseResponseJson(locking.Authenticate(CreateLoginRequest(user, "password123")))
                .GetProperty("success").GetBoolean());

            // the same account, once its lockout window has elapsed, is usable again
            var elapsed = new TestRestApiLogin(user, "password123")
            {
                PenaltyStart = 100,
                PermanentAttempts = 3,
                PermanentDurationSeconds = 0
            };

            // act
            var result = elapsed.Authenticate(CreateLoginRequest(user, "password123"));

            // assert
            Assert.True(ParseResponseJson(result).GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// The manual unlock lifts a lock at once, so an administrator need not wait out the
        /// duration to restore a wrongly locked-out account.
        /// </summary>
        [Fact]
        public void Lockout_Reset_UnlocksImmediately()
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123")
            {
                PenaltyStart = 100,
                PermanentAttempts = 3,
                PermanentDurationSeconds = 3600
            };

            for (var i = 0; i < 3; i++)
            {
                api.Authenticate(CreateLoginRequest(user, "wrong"));
            }

            Assert.False(ParseResponseJson(api.Authenticate(CreateLoginRequest(user, "password123")))
                .GetProperty("success").GetBoolean());

            // act
            api.Unlock(CreateLoginRequest(user, "password123"), user);
            var result = api.Authenticate(CreateLoginRequest(user, "password123"));

            // assert
            Assert.True(ParseResponseJson(result).GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// Keeps both the first rate-limit response and subsequent countdown in the request's language.
        /// </summary>
        /// <param name="language">The browser language, independent of the server's English default.</param>
        /// <param name="rateLimitMessage">The expected message when the penalty first starts.</param>
        /// <param name="retryMessage">The expected countdown template containing the remaining seconds.</param>
        [Theory]
        [InlineData("en", "Too many failed attempts. Please wait before trying to sign in again.",
            "Please wait {0} seconds before trying to sign in again.")]
        [InlineData("de", "Zu viele fehlgeschlagene Versuche. Bitte warten Sie, bevor Sie sich erneut anmelden.",
            "Bitte warten Sie {0} Sekunden, bevor Sie sich erneut anmelden.")]
        public void Authenticate_RateLimited_ReturnsLocalizedCountdown(string language, string rateLimitMessage, string retryMessage)
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123") { PenaltyStart = 1 };

            // act
            var first = ParseResponseJson(api.Authenticate(CreateLoginRequest(user, "wrong", language: language)));
            var retry = ParseResponseJson(api.Authenticate(CreateLoginRequest(user, "password123", language: language)));

            // validation
            Assert.Equal(rateLimitMessage, first.GetProperty("message").GetString());
            var seconds = retry.GetProperty("retryAfter").GetInt32();
            Assert.InRange(seconds, 1, 30);
            Assert.Equal(string.Format(retryMessage, seconds), retry.GetProperty("message").GetString());
            Assert.False(retry.GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// Prevents hard-lock messages from exposing a translation key or an unfilled countdown placeholder.
        /// </summary>
        /// <param name="language">The browser language to use for both lockout responses.</param>
        /// <param name="message">The expected translated message without a countdown placeholder.</param>
        [Theory]
        [InlineData("en", "Too many failed attempts. Your account is temporarily locked. Please try again later.")]
        [InlineData("de", "Zu viele fehlgeschlagene Versuche. Ihr Konto ist vorübergehend gesperrt. Bitte versuchen Sie es später erneut.")]
        public void Authenticate_HardLocked_ReturnsLocalizedMessage(string language, string message)
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123") { PermanentAttempts = 1 };

            // act
            var first = ParseResponseJson(api.Authenticate(CreateLoginRequest(user, "wrong", language: language)));
            var retry = ParseResponseJson(api.Authenticate(CreateLoginRequest(user, "password123", language: language)));

            // validation
            Assert.Equal(message, first.GetProperty("message").GetString());
            Assert.Equal(message, retry.GetProperty("message").GetString());
            Assert.False(retry.GetProperty("success").GetBoolean());
        }

        /// <summary>
        /// Uses the browser language for successful login and logout feedback as well as failures.
        /// </summary>
        /// <param name="language">The browser language to use for the authentication feedback.</param>
        /// <param name="loginMessage">The expected translated login confirmation.</param>
        /// <param name="logoutMessage">The expected translated logout confirmation.</param>
        [Theory]
        [InlineData("en", "You have signed in successfully.", "You have signed out successfully.")]
        [InlineData("de", "Sie wurden erfolgreich angemeldet.", "Sie wurden erfolgreich abgemeldet.")]
        public void AuthenticateAndLogout_ReturnLocalizedConfirmation(string language, string loginMessage, string logoutMessage)
        {
            // arrange
            _ = CreateAuthenticationHub();
            var user = UniqueUser();
            var api = new TestRestApiLogin(user, "password123");
            var request = CreateLoginRequest(user, "password123", language: language);

            // act
            var login = ParseResponseJson(api.Authenticate(request));
            var logout = ParseResponseJson(api.Logout(request));

            // validation
            Assert.True(login.GetProperty("success").GetBoolean());
            Assert.Equal(loginMessage, login.GetProperty("message").GetString());
            Assert.True(logout.GetProperty("success").GetBoolean());
            Assert.Equal(logoutMessage, logout.GetProperty("message").GetString());
        }

        /// <summary>
        /// Creates a mock login request carrying the given body verbatim, so a test can send a
        /// document the endpoint has to reject rather than one the serializer would shape.
        /// </summary>
        /// <param name="payload">The exact JSON body used to exercise credential input validation.</param>
        /// <param name="language">The browser language used to select response messages.</param>
        /// <returns>The request carrying the supplied raw JSON body.</returns>
        private static IRequest CreateRawLoginRequest(string payload, string language = "en")
        {
            var content = "POST /api/login HTTP/1.1\r\nHost: localhost\r\nAccept-Language: " + language
                + "\r\nContent-Type: application/json\r\n\r\n" + payload;

            return UnitTestControlFixture.CreateRequestMock(content, "/api/login");
        }

        /// <summary>
        /// Creates a mock login request with the specified credentials, optionally scoped to a
        /// named application so a test can prove lockouts are confined to one application.
        /// </summary>
        /// <param name="username">The submitted account name to resolve through the local directory.</param>
        /// <param name="password">The password to verify before returning an authenticated identity.</param>
        /// <param name="applicationId">The application identifier that scopes token audiences and authentication.</param>
        /// <param name="language">The browser language used to select response messages.</param>
        /// <returns>The request carrying credentials for the selected application.</returns>
        private static IRequest CreateLoginRequest(string username, string password, string applicationId = "login-tests", string language = "en")
        {
            var request = CreateRawLoginRequest(JsonSerializer.Serialize(new { username, password }), language);

            if (applicationId is not null)
            {
                // the application id carries an internal setter in WebCore; reflection stands in
                // for the framework wiring that would set it on a real request
                var applicationContext = request.ApplicationContext;
                applicationContext.GetType()
                    .GetProperty("ApplicationId", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
                    ?.SetValue(applicationContext, applicationId);
            }

            return request;
        }

        /// <summary>
        /// A username unique to a test run, so the process-wide lockout store never carries state
        /// from one test into another.
        /// </summary>
        /// <returns>A username unique to the current test scenario.</returns>
        private static string UniqueUser()
        {
            return "user_" + Guid.NewGuid().ToString("N");
        }

        /// <summary>
        /// Parses a JSON response from the given response object.
        /// </summary>
        /// <param name="response">The outgoing response governed by the authentication transport contract.</param>
        /// <returns>The response payload detached from its owning JSON document.</returns>
        private static JsonElement ParseResponseJson(IResponse response)
        {
            var json = response.Content is byte[] bytes
                ? Encoding.UTF8.GetString(bytes)
                : response.Content?.ToString();

            return JsonDocument.Parse(json).RootElement;
        }

        /// <summary>
        /// Test implementation of RestApiLogin for unit testing. The lockout knobs are made
        /// settable so a test can reach a hard lock in a few attempts without waiting out the
        /// exponential penalty, and the session step can be told to fail on demand.
        /// </summary>
        private sealed class TestRestApiLogin : RestApiSession
        {
            private readonly string _validUsername;
            private readonly string _validPassword;

            /// <summary>
            /// Keeps credential acceptance deterministic while exercising the real login pipeline.
            /// </summary>
            /// <param name="validUsername">The account name accepted by this test provider.</param>
            /// <param name="validPassword">The password accepted by this test provider.</param>
            public TestRestApiLogin(string validUsername, string validPassword)
            {
                _validUsername = validUsername;
                _validPassword = validPassword;
            }

            /// <summary>
            /// When set, <see cref="EstablishIdentity"/> returns null, simulating a failed sign-in
            /// on otherwise valid credentials.
            /// </summary>
            public bool FailSessionCreation { get; set; }

            public int? PenaltyStart { get; set; }
            public int? PermanentAttempts { get; set; }
            public int? PermanentDurationSeconds { get; set; }

            protected override int PenaltyStartAttempts => PenaltyStart ?? base.PenaltyStartAttempts;
            protected override int PermanentLockoutAttempts => PermanentAttempts ?? base.PermanentLockoutAttempts;
            protected override int PermanentLockoutDurationSeconds => PermanentDurationSeconds ?? base.PermanentLockoutDurationSeconds;

            /// <summary>
            /// Returns an identity only for credentials accepted by this test provider.
            /// </summary>
            /// <param name="username">The submitted account name to resolve through the local directory.</param>
            /// <param name="password">The password to verify before returning an authenticated identity.</param>
            /// <returns>The configured identity, or null when the test rejects the credentials.</returns>
            protected override IIdentity ValidateCredentials(string username, string password)
            {
                if (string.Equals(username, _validUsername, System.StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(password, _validPassword))
                {
                    return new TestIdentity(username);
                }

                return null;
            }

            /// <summary>
            /// Allows tests to distinguish credential validation from successful token issuance.
            /// </summary>
            /// <param name="identity">The verified identity whose authorization snapshot is being processed.</param>
            /// <param name="request">The HTTP request whose authentication context is being evaluated.</param>
            /// <returns>The issued token pair, or null when the test simulates issuance failure.</returns>
            protected override IdentityTokenPair EstablishIdentity(IIdentity identity, IRequest request)
            {
                return FailSessionCreation ? null : base.EstablishIdentity(identity, request);
            }

            /// <summary>
            /// Exposes the protected reset so a test can stand in for an administrative unlock.
            /// </summary>
            /// <param name="request">The HTTP request whose authentication context is being evaluated.</param>
            /// <param name="username">The submitted account name to resolve through the local directory.</param>
            public void Unlock(IRequest request, string username)
            {
                ResetFailedAttempts(request, username);
            }
        }

        /// <summary>
        /// Simple test identity for unit testing.
        /// </summary>
        private sealed class TestIdentity : IIdentity
        {
            public Guid Id { get; } = Guid.NewGuid();
            public string Name { get; }
            public string Email { get; } = "";
            public string PasswordHash { get; } = "";
            public IEnumerable<IIdentityGroup> Groups { get; } = [];

            public string Login { get; }

            /// <summary>
            /// Supplies an authenticated test subject independently of application session state.
            /// </summary>
            /// <param name="login">The account name used for the test identity.</param>
            public TestIdentity(string login)
            {
                Login = login;
                Name = login;
            }
        }
    }
}
