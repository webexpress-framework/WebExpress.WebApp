using WebExpress.WebApp.WebTheme;
using WebExpress.WebCore.WebAttribute;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy theme for testing.
    /// </summary>
    [Name("TestThemeB")]
    public sealed class TestThemeB : IThemeWebApp
    {
        /// <summary>
        /// Gets the text color for the theme.
        /// </summary>
        /// <value>
        /// A string representing the text color in hexadecimal format.
        /// </value>
        public static string TextColor => "FFFFFF";
    }
}
