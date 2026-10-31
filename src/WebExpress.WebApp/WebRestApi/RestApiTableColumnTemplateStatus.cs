using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "status" for REST API
    /// table rendering. The cell value names the status
    /// (pending, running, warning, error or done) and is condensed into a
    /// colored status dot. The template is read-only.
    /// </summary>
    public class RestApiTableColumnTemplateStatus : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "status";

        /// <summary>
        /// Gets a value indicating whether the translated status name is
        /// shown beside the dot.
        /// </summary>
        public bool ShowLabel { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="showLabel">
        /// A value indicating whether the translated status name is shown
        /// beside the dot.
        /// </param>
        public RestApiTableColumnTemplateStatus(bool showLabel = false)
        {
            ShowLabel = showLabel;
        }

        /// <summary>
        /// Collects the options the client-side status renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["showLabel"] = ShowLabel
        };
    }
}
