using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "editor" for REST API
    /// table rendering: the cell value is rendered as rich text and edited
    /// with the full editor in edit mode.
    /// </summary>
    public class RestApiTableColumnTemplateEditor : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "editor";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        public RestApiTableColumnTemplateEditor(bool editable = false)
        {
            Editable = editable;
        }

        /// <summary>
        /// Collects the options the client-side editor renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable
        };
    }
}
