using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "traffic-light" for REST
    /// API table rendering. The cell value names the active lamp
    /// (red, yellow or green).
    /// </summary>
    public class RestApiTableColumnTemplateTrafficLight : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "traffic-light";

        /// <summary>
        /// Gets a value indicating whether the lamps are laid out horizontally.
        /// </summary>
        public bool Horizontal { get; private set; }

        /// <summary>
        /// Gets the size token of the traffic light (for example "sm"), or
        /// null for the default size.
        /// </summary>
        public string Size { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="horizontal">
        /// A value indicating whether the lamps are laid out horizontally.
        /// </param>
        /// <param name="size">
        /// The size token of the traffic light (for example "sm"). Can be null.
        /// </param>
        public RestApiTableColumnTemplateTrafficLight(bool editable = false, bool horizontal = false, string size = null)
        {
            Editable = editable;
            Horizontal = horizontal;
            Size = size;
        }

        /// <summary>
        /// Collects the options the client-side traffic light renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["orientation"] = Horizontal ? "horizontal" : "vertical",
            ["size"] = Size
        };
    }
}
