using System;

namespace WebExpress.WebApp.WebTheme
{
    /// <summary>
    /// Describes a set of drawings a visitor can choose independently of the color theme.
    /// </summary>
    /// <remarks>
    /// Icons are css masks selected by class, so a set is nothing but a stylesheet that points
    /// those classes at other drawings and is added after the framework rules. A set without
    /// a stylesheet stands for the framework's own drawings, which keeps "no override" a
    /// choice the visitor can return to.
    /// </remarks>
    public sealed class IconSet
    {
        /// <summary>
        /// Gets the framework's own drawings, ready to be offered as the way back from an override.
        /// </summary>
        public static IconSet Default { get; } = new
        (
            "default",
            "webexpress.webapp:setting.theme.iconset.default.name",
            "webexpress.webapp:setting.theme.iconset.default.description"
        );

        /// <summary>
        /// Gets the stable identifier stored as the visitor's preference.
        /// </summary>
        public string Id { get; }

        /// <summary>
        /// Gets the display name or its internationalization key.
        /// </summary>
        public string Name { get; }

        /// <summary>
        /// Gets the optional description or its internationalization key.
        /// </summary>
        public string Description { get; }

        /// <summary>
        /// Gets the stylesheet relative to the application route, or null for the framework's
        /// own drawings. It is relative because the application decides where it is mounted.
        /// </summary>
        public string Stylesheet { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The stable identifier stored as the preference.</param>
        /// <param name="name">The display name or its internationalization key.</param>
        /// <param name="description">The optional description or its internationalization key.</param>
        /// <param name="stylesheet">The stylesheet relative to the application route, or null for the framework drawings.</param>
        public IconSet(string id, string name, string description = null, string stylesheet = null)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("An icon set requires an identifier.", nameof(id));
            }

            Id = id;
            Name = name ?? id;
            Description = description;
            Stylesheet = stylesheet;
        }
    }
}
