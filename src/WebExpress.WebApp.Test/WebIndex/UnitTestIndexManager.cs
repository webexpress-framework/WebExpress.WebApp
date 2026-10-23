using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebCore.Internationalization;

namespace WebExpress.WebApp.Test.WebIndex
{
    /// <summary>
    /// Provides unit tests for the index manager of the web application.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestIndexManager
    {
        /// <summary>
        /// Verifies that the messages of the wql parser reach the user translated, although
        /// webindex is a library the plugin scan never visits.
        /// </summary>
        /// <param name="language">The Accept-Language of the request.</param>
        /// <param name="expected">The expected translation.</param>
        [Theory]
        [InlineData("de", "Unbekannte Bedingung.")]
        [InlineData("en", "Unknown condition.")]
        public void TranslatesWebIndexMessages(string language, string expected)
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var request = UnitTestControlFixture.CreateRequestMock($"GET / HTTP/1.1\r\nAccept-Language: {language}\r\n\r\n");

            // act
            var translated = I18N.Translate(request, "webexpress.webindex:wql.condition_unknown");

            // validation
            Assert.Equal(expected, translated);
        }
    }
}
