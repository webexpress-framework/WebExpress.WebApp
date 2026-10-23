using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "html" for REST API table
    /// rendering. The cell value is inserted as raw HTML on the client, so
    /// the content must come from a trusted source such as the server; data
    /// that may contain user input belongs in the text or markdown template
    /// instead. The template is read-only.
    /// </summary>
    public class RestApiTableColumnTemplateHtml : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "html";

        /// <summary>
        /// Collects the options the client-side html renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>();
    }
}
