using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "move" for REST API table
    /// rendering: a dual-list picker that moves items between an available
    /// and a selected side. The items travel embedded in the options.
    /// </summary>
    public class RestApiTableColumnTemplateMove : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "move";

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
        public RestApiTableColumnTemplateMove(bool editable = false)
        {
            Editable = editable;
        }

        /// <summary>
        /// Collects the options the client-side move renderer reads. The
        /// items are embedded as a JSON string, which the renderer parses.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["options"] = ToEmbeddedJson((Items ?? []).Select(x => new
            {
                id = x.Id,
                label = x.Text,
                labelColor = x.Color
            }))
        };
    }
}
