using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebTheme;

namespace WebExpress.WebApp.Test.WebTheme
{
    /// <summary>
    /// Test the theme manager.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestThemeManager
    {
        /// <summary>
        /// Test the id property of the theme.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(TestThemeA), "webexpress.webapp.test.testthemea")]
        public void Id(Type applicationType, Type themeType, string id)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // test execution
            var themeContexts = componentHub.ThemeManager.GetThemes(application, themeType);

            if (id is null)
            {
                Assert.Empty(themeContexts);
                return;
            }

            Assert.Contains(id, themeContexts.Select(x => x.ThemeId?.ToString()));
        }

        /// <summary>
        /// Test the GetWebAppTheme function of the theme manager.
        /// </summary>
        [Theory]
        [InlineData(typeof(TestApplication), typeof(TestThemeA), "webexpress.webapp.test.testthemea")]
        public void GetWebAppTheme(Type applicationType, Type themeType, string id)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(applicationType).FirstOrDefault();

            // test execution
            var themeContext = componentHub.ThemeManager.GetThemes(application, themeType).FirstOrDefault();
            var theme = componentHub.ThemeManager.GetWebAppTheme(themeContext);

            Assert.NotNull(theme);
            Assert.Equal(id, theme.GetType().FullName.ToLower());
        }
    }
}
