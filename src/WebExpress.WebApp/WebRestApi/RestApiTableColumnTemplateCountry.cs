using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "country" for REST API table rendering:
    /// the flag and name of a country in read-only mode and a searchable country picker in
    /// edit mode. A cell holds the ISO 3166-1 alpha-2 code, several separated by a semicolon.
    /// An editable column embeds the countries in its options, named in the culture the
    /// template was created with; without one, and in a read-only column, the browser names
    /// them in the language of the page.
    /// </summary>
    public class RestApiTableColumnTemplateCountry : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "country";

        /// <summary>
        /// Gets a value indicating whether a cell can hold several countries.
        /// </summary>
        public bool MultiSelect { get; private set; }

        /// <summary>
        /// Gets the culture the countries are named in, or null to leave the naming to the browser.
        /// </summary>
        public CultureInfo Culture { get; private set; }

        /// <summary>
        /// Gets or sets the codes of the countries offered when a cell is edited. Left unset,
        /// every country of the <see cref="CountryCatalog"/> is offered.
        /// </summary>
        public IEnumerable<string> Countries { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the name is shown beside the flag.
        /// </summary>
        public bool ShowName { get; set; } = true;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="multiSelect">
        /// A value indicating whether a cell can hold several countries.
        /// </param>
        /// <param name="culture">
        /// The culture of the request, which names the countries. Can be null.
        /// </param>
        public RestApiTableColumnTemplateCountry(bool editable = false, bool multiSelect = false, CultureInfo culture = null)
        {
            Editable = editable;
            MultiSelect = multiSelect;
            Culture = culture;
        }

        /// <summary>
        /// Collects the options the client-side country renderer reads. The countries of an
        /// editable column are embedded as a JSON string, which the renderer parses.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions()
        {
            var options = new Dictionary<string, object>
            {
                ["editable"] = Editable,
                ["multiselection"] = MultiSelect,
                ["showName"] = ShowName
            };

            // only the picker needs the list; a read-only column leaves the naming to the browser
            if (Editable)
            {
                options["options"] = ToEmbeddedJson(CountryCatalog.Restrict(Countries).Select(x => new
                {
                    id = x,
                    label = Culture is null ? null : CountryCatalog.GetName(Culture, x)
                }));
            }

            return options;
        }
    }
}
