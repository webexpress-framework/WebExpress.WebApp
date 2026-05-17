using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebIndex.Queries;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Tests <see cref="RestApiTheme"/>: GET serialises themes registered
    /// for the request's application and PUT forwards the chosen id to the
    /// virtual <see cref="RestApiTheme.PersistSelection"/> hook. The
    /// framework itself does NOT store the choice - user code overrides the
    /// hooks and plugs in whatever persistence fits the application.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiTheme
    {
        /// <summary>
        /// Minimal concrete derivation used in tests; persistence hooks are
        /// backed by a per-instance in-memory field so tests can verify the
        /// PUT flow without bringing real storage in.
        /// </summary>
        private sealed class TestRestApiTheme : RestApiTheme
        {
            private string _persisted;

            public string LastPersisted => _persisted;

            protected override string GetActiveThemeId(IQueryContext context, IRequest request)
            {
                return _persisted;
            }

            protected override void PersistSelection(string themeId, IQueryContext context, IRequest request)
            {
                _persisted = themeId;
            }
        }

        /// <summary>
        /// Helper: swap the ad-hoc ApplicationContext on the request mock
        /// with one of the manager-registered instances so theme lookup
        /// resolves the right themes.
        /// </summary>
        private static void AssignApplicationContext(IRequest request, IApplicationContext applicationContext)
        {
            var prop = request.GetType().GetProperty("ApplicationContext",
                BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            prop?.SetValue(request, applicationContext);
        }

        /// <summary>
        /// GET emits the themes registered for the application carried by
        /// the request, in the JSON envelope expected by the JS controller.
        /// </summary>
        [Fact]
        public void Retrieve_ReturnsRegisteredThemes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var request = UnitTestControlFixture.CreateRequestMock();
            AssignApplicationContext(request, application);

            var api = new TestRestApiTheme();

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var items = doc.RootElement.GetProperty("items").EnumerateArray().ToList();

            Assert.True(items.Count >= 2, $"expected at least two themes, got {items.Count}");
            Assert.Contains(items, i => i.GetProperty("id").GetString() == "webexpress.webapp.test.testthemea");

            var selected = doc.RootElement.GetProperty("selected");
            Assert.True(selected.ValueKind == JsonValueKind.Null || string.IsNullOrEmpty(selected.GetString()));
        }

        /// <summary>
        /// GET marks the user-stored theme with <c>selected:true</c> in
        /// the items array so the JS dropdown can highlight it.
        /// </summary>
        [Fact]
        public void Retrieve_MarksUserStoredTheme()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager
                .GetApplications(typeof(TestApplication))
                .FirstOrDefault();

            var request = (Request)UnitTestControlFixture.CreateRequestMock();
            AssignApplicationContext(request, application);

            var api = new TestRestApiTheme();
            // simulate prior user pick.
            request.AddParameter(new Parameter("v", "webexpress.webapp.test.testthemea", ParameterScope.Parameter));
            _ = api.Update(request);

            // act
            var result = api.Retrieve(request);

            // validation
            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);

            Assert.Equal("webexpress.webapp.test.testthemea", doc.RootElement.GetProperty("selected").GetString());
            var matched = doc.RootElement.GetProperty("items").EnumerateArray()
                .FirstOrDefault(i => i.GetProperty("id").GetString() == "webexpress.webapp.test.testthemea");
            Assert.True(matched.TryGetProperty("selected", out var marker) && marker.GetBoolean());
        }

        /// <summary>
        /// PUT forwards the selection to <see cref="RestApiTheme.PersistSelection"/>
        /// and echoes the new state via <see cref="RestApiTheme.GetActiveThemeId"/>.
        /// The framework itself attaches no cookies.
        /// </summary>
        [Fact]
        public void Update_InvokesPersistSelectionHook()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = (Request)UnitTestControlFixture.CreateRequestMock();
            request.AddParameter(new Parameter("v", "webexpress.webapp.test.testthemea", ParameterScope.Parameter));

            var api = new TestRestApiTheme();

            // act
            var result = api.Update(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var response = result as Response;
            Assert.NotNull(response);
            Assert.Empty(response.Header.Cookies);
            Assert.Equal("webexpress.webapp.test.testthemea", api.LastPersisted);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            Assert.Equal("webexpress.webapp.test.testthemea", doc.RootElement.GetProperty("selected").GetString());
        }

        /// <summary>
        /// PUT with an empty <c>v</c> parameter clears the user pick - the
        /// hook is called with <see langword="null"/> so user code knows the
        /// preference was cleared.
        /// </summary>
        [Fact]
        public void Update_EmptyValueClearsSelection()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = (Request)UnitTestControlFixture.CreateRequestMock();

            var api = new TestRestApiTheme();
            // seed: first pick a theme...
            request.AddParameter(new Parameter("v", "webexpress.webapp.test.testthemea", ParameterScope.Parameter));
            _ = api.Update(request);
            Assert.Equal("webexpress.webapp.test.testthemea", api.LastPersisted);

            // ...then clear it via empty v on a fresh request.
            var clearing = (Request)UnitTestControlFixture.CreateRequestMock();
            clearing.AddParameter(new Parameter("v", string.Empty, ParameterScope.Parameter));

            // act
            var result = api.Update(clearing);
            var response = result as Response;

            // validation
            Assert.NotNull(response);
            Assert.Empty(response.Header.Cookies);
            Assert.Null(api.LastPersisted);
        }
    }
}
