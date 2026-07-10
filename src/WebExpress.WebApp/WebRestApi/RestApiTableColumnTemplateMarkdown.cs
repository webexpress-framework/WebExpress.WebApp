using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "markdown" for REST API
    /// table rendering. The cell value is rendered as a markdown subset; the
    /// raw value is escaped on the client before the markup is rewritten, so
    /// markdown data cannot inject HTML. The template is read-only.
    /// </summary>
    public class RestApiTableColumnTemplateMarkdown : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "markdown";

        /// <summary>
        /// Collects the options the client-side markdown renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>();
    }
}
