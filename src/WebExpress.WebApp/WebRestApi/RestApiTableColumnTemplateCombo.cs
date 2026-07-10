using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "combo" for REST API table
    /// rendering: a native single-choice select whose items travel embedded
    /// in the options. A large or shared item set belongs in the
    /// "rest_combo" template instead, which loads its items from an endpoint.
    /// </summary>
    public class RestApiTableColumnTemplateCombo : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "combo";

        /// <summary>
        /// Gets the selectable items of the column.
        /// </summary>
        public IEnumerable<RestApiTableColumnTemplateItem> Items { get; set; } = [];

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        public RestApiTableColumnTemplateCombo(bool editable = false)
        {
            Editable = editable;
        }

        /// <summary>
        /// Collects the options the client-side combo renderer reads. The
        /// items are embedded as a JSON string, which the renderer parses.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["options"] = ToEmbeddedJson((Items ?? []).Select(x => new
            {
                value = x.Id,
                text = x.Text
            }))
        };
    }
}
