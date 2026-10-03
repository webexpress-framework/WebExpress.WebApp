using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "color" for REST API table
    /// rendering: a color swatch in read-only mode and a color picker in
    /// edit mode.
    /// </summary>
    public class RestApiTableColumnTemplateColor : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "color";

        /// <summary>
        /// Gets the tooltip shown on the read-only swatch, or null for none.
        /// </summary>
        public string Tooltip { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="tooltip">
        /// The tooltip shown on the read-only swatch. Can be null.
        /// </param>
        public RestApiTableColumnTemplateColor(bool editable = false, string tooltip = null)
        {
            Editable = editable;
            Tooltip = tooltip;
        }

        /// <summary>
        /// Collects the options the client-side color renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["tooltip"] = Tooltip
        };
    }
}
