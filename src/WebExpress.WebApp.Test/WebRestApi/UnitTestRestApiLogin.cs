using System;
using System.Collections.Generic;
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
    public class UnitTestRestApiLogin
    {
        /// <summary>
        /// Tests successful authentication.
        /// </summary>
        [Fact]
        public void AuthenticateSuccess()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new TestRestApiLogin("admin", "password123");
            var request = CreateLoginRequest("admin", "password123");

            // act
            var result = api.Authenticate(request);

            // assert
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = ParseResponseJson(result);
            Assert.True(json.GetProperty("success").GetBoolean());
            Assert.Equal("Authentication successful.", json.GetProperty("message").GetString());
        }

        /// <summary>
        /// Tests failed authentication with wrong password.
        /// </summary>
        [Fact]
        public void AuthenticateInvalidPassword()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
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
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
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
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
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
        /// Tests the login result for a successful response.
        /// </summary>
        [Fact]
        public void LoginResultSuccess()
        {
            // arrange
            var loginResult = new RestApiLoginResult
            {
                Success = true,
                Token = "test-token",
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
            var loginResult = new RestApiLoginResult
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
            var loginResult = new RestApiLoginResult
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
        /// Creates a mock login request with the specified credentials.
        /// </summary>
        private static IRequest CreateLoginRequest(string username, string password)
        {
            var payload = JsonSerializer.Serialize(new { username, password });
            var content = "POST /api/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n\r\n" + payload;

            return UnitTestControlFixture.CreateRequestMock(content, "/api/login");
        }

        /// <summary>
        /// Parses a JSON response from the given response object.
        /// </summary>
        private static JsonElement ParseResponseJson(IResponse response)
        {
            var json = response.Content is byte[] bytes
                ? Encoding.UTF8.GetString(bytes)
                : response.Content?.ToString();

            return JsonDocument.Parse(json).RootElement;
        }

        /// <summary>
        /// Test implementation of RestApiLogin for unit testing.
        /// </summary>
        private sealed class TestRestApiLogin : RestApiLogin
        {
            private readonly string _validUsername;
            private readonly string _validPassword;

            public TestRestApiLogin(string validUsername, string validPassword)
            {
                _validUsername = validUsername;
                _validPassword = validPassword;
            }

            protected override IIdentity ValidateCredentials(string username, string password)
            {
                if (string.Equals(username, _validUsername, System.StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(password, _validPassword))
                {
                    return new TestIdentity(username);
                }

                return null;
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

            public TestIdentity(string login)
            {
                Login = login;
                Name = login;
            }
        }
    }
}
