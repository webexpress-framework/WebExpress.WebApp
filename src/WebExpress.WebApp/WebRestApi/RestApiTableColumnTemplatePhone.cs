using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "phone" for REST API table rendering: the flag
    /// and a link that dials the number in read-only mode and the phone field with its country
    /// picker in edit mode. A cell holds the number in E.164 form.
    /// </summary>
    public class RestApiTableColumnTemplatePhone : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "phone";

        /// <summary>
        /// Gets the country an empty edited cell starts in, or null for the one of the page language.
        /// </summary>
        public string Country { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="country">
        /// The ISO 3166-1 alpha-2 code of the country an empty edited cell starts in. Can be null.
        /// </param>
        public RestApiTableColumnTemplatePhone(bool editable = false, string country = null)
        {
            Editable = editable;
            Country = CountryCatalog.Normalize(country);
        }

        /// <summary>
        /// Collects the options the client-side phone renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["country"] = Country
        };
    }
}
