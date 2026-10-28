using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "email" for REST API table rendering: a link
    /// that writes to the address in read-only mode and an e-mail field in edit mode.
    /// </summary>
    public class RestApiTableColumnTemplateEmail : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "email";

        /// <summary>
        /// Gets the placeholder text displayed while an edited cell is empty.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="placeholder">
        /// The placeholder text displayed while an edited cell is empty. Can be null.
        /// </param>
        public RestApiTableColumnTemplateEmail(bool editable = false, string placeholder = null)
        {
            Editable = editable;
            Placeholder = placeholder;
        }

        /// <summary>
        /// Collects the options the client-side e-mail renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["placeholder"] = Placeholder
        };
    }
}
