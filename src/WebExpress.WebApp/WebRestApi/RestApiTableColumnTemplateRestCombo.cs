using System.Collections.Generic;
using WebExpress.WebCore.WebUri;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "rest_combo" for REST API
    /// table rendering: a single-choice picker whose items are loaded from a
    /// REST endpoint.
    /// </summary>
    public class RestApiTableColumnTemplateRestCombo : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "rest_combo";

        /// <summary>
        /// Gets the placeholder text to display when the input field is empty.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Gets or sets the endpoint that serves the selectable items.
        /// </summary>
        public IUri Uri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="placeholder">
        /// The placeholder text to display when the column value is empty. Can be null.
        /// </param>
        public RestApiTableColumnTemplateRestCombo(bool editable = false, string placeholder = null)
        {
            Editable = editable;
            Placeholder = placeholder;
        }

        /// <summary>
        /// Collects the options the client-side rest combo renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["placeholder"] = Placeholder,
            ["uri"] = Uri?.ToString()
        };
    }
}
