using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.WebAttribute;
using WebExpress.WebCore.WebIcon;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy theme for testing.
    /// </summary>
    [Name("TestThemeA")]
    [Description("A dummy theme for testing.")]
    [Image("webexpress.webcore.test.testthemea.png")]
    [IconTheme(TypeIconTheme.Light)]
    public sealed class TestThemeA : IThemeWebApp
    {
        /// <summary>
        /// Gets the text color for the theme.
        /// </summary>
        /// <value>
        /// A string representing the text color in hexadecimal format.
        /// </value>
        public static string TextColor => "000000";
    }
}
