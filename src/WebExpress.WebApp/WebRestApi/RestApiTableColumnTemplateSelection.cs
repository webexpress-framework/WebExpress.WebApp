using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "selection" for REST API
    /// table rendering. The selectable items travel embedded in the options,
    /// so the client renders the picker without a further request; a large or
    /// shared item set belongs in the "rest_selection" template instead,
    /// which loads its items from an endpoint.
    /// </summary>
    public class RestApiTableColumnTemplateSelection : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "selection";

        /// <summary>
        /// Gets a value indicating whether multiple items can be selected.
        /// </summary>
        public bool MultiSelect { get; private set; }

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
        /// <param name="multiSelect">
        /// A value indicating whether multiple items can be selected.
        /// </param>
        public RestApiTableColumnTemplateSelection(bool editable = false, bool multiSelect = false)
        {
            Editable = editable;
            MultiSelect = multiSelect;
        }

        /// <summary>
        /// Collects the options the client-side selection renderer reads. The
        /// items are embedded as a JSON string, which the renderer parses.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["multiselection"] = MultiSelect,
            ["options"] = ToEmbeddedJson((Items ?? []).Select(x => new
            {
                id = x.Id,
                label = x.Text,
                labelColor = x.Color
            }))
        };
    }
}
