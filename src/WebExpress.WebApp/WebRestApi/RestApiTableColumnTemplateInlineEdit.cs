using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Configures generic cell editing without application field or permission rules.
    /// </summary>
    public sealed class RestApiTableColumnTemplateInlineEdit : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the client template identifier.
        /// </summary>
        public override string Type => "inline-edit";
        /// <summary>
        /// Gets or sets the write endpoint, falling back to the row REST address.
        /// </summary>
        public string Endpoint { get; set; }
        /// <summary>
        /// Gets or sets the payload field name, falling back to the column name.
        /// </summary>
        public string Field { get; set; }
        /// <summary>
        /// Gets or sets the read-only cell template.
        /// </summary>
        public string Kind { get; set; } = "text";
        /// <summary>
        /// Gets or sets the editor kind: text, textarea, select, number or date.
        /// </summary>
        public string Editor { get; set; } = "text";
        /// <summary>
        /// Gets or sets the HTTP method.
        /// </summary>
        public string Method { get; set; } = "PATCH";
        /// <summary>
        /// Gets the application-provided editor and display options.
        /// </summary>
        public IDictionary<string, object> Options { get; } = new Dictionary<string, object>();
        /// <summary>
        /// Initializes an explicitly editable column template.
        /// </summary>
        /// <param name="editable">Whether the application offers editing for this column.</param>
        public RestApiTableColumnTemplateInlineEdit(bool editable = true)
        {
            Editable = editable;
        }
        /// <summary>
        /// Produces the shared server and client configuration contract.
        /// </summary>
        /// <returns>The client template options.</returns>
        protected override IDictionary<string, object> CreateOptions()
        {
            var options = new Dictionary<string, object>(Options)
            {
                ["endpoint"] = Endpoint, ["field"] = Field, ["kind"] = Kind,
                ["editor"] = Editor, ["method"] = Method, ["editable"] = Editable
            };
            return options;
        }
    }
}
