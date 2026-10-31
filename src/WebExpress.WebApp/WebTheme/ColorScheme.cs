using System;
using System.Collections.Generic;
using WebExpress.WebCore.WebTheme;

namespace WebExpress.WebApp.WebTheme
{
    /// <summary>
    /// The light or dark mode a visitor chooses independently of the theme.
    /// </summary>
    /// <remarks>
    /// Every theme comes in a light and a dark variant, so the mode is a decision of its own.
    /// A visitor who has not chosen sees the mode the theme declares as its default
    /// (<see cref="WebCore.WebAttribute.ThemeModeAttribute"/>).
    /// </remarks>
    public static class ColorScheme
    {
        /// <summary>
        /// Renders the theme in its light variant.
        /// </summary>
        public const string Light = "light";

        /// <summary>
        /// Renders the theme in its dark variant.
        /// </summary>
        public const string Dark = "dark";

        /// <summary>
        /// Gets the selectable modes in the order the picker offers them.
        /// </summary>
        public static IReadOnlyList<string> All { get; } = [Light, Dark];

        /// <summary>
        /// Reduces a stored or submitted value to a mode.
        /// </summary>
        /// <param name="value">The value.</param>
        /// <returns><see cref="Light"/> or <see cref="Dark"/>, or null for no choice.</returns>
        public static string Normalize(string value)
        {
            return string.Equals(value, Light, StringComparison.OrdinalIgnoreCase) ? Light
                : string.Equals(value, Dark, StringComparison.OrdinalIgnoreCase) ? Dark
                : null;
        }

        /// <summary>
        /// Returns the mode a theme declares for visitors who have not chosen one.
        /// </summary>
        /// <param name="theme">The theme, or null.</param>
        /// <returns><see cref="Dark"/> for a theme declared dark, otherwise <see cref="Light"/>.</returns>
        public static string Default(IThemeContext theme)
        {
            return theme?.ThemeMode == ThemeMode.Dark ? Dark : Light;
        }
    }
}
