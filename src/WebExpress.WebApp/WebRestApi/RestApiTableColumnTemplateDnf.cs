using System.Collections.Generic;
using System.Linq;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "dnf" for REST API table
    /// rendering. The column holds a disjunctive normal form - a filter written as
    /// (A AND B) OR (C) - and the selectable terms travel embedded in the options,
    /// so the client renders the expression without a further request. A large or
    /// shared term set belongs in the "rest_dnf" template instead, which loads its
    /// terms from an endpoint.
    /// </summary>
    public class RestApiTableColumnTemplateDnf : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "dnf";

        /// <summary>
        /// Gets or sets the selectable terms of the column.
        /// </summary>
        public IEnumerable<RestApiTableColumnTemplateItem> Items { get; set; } = [];

        /// <summary>
        /// Gets the placeholder shown in a conjunction that holds no term yet.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Gets the maximum number of conjunctions, or a value of zero or less for
        /// an unlimited number.
        /// </summary>
        public int MaxGroups { get; private set; }

        /// <summary>
        /// Gets a value indicating whether the read state clips the expression to a
        /// single line.
        /// </summary>
        public bool Compact { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">A value indicating whether the column is editable.</param>
        /// <param name="placeholder">
        /// The placeholder shown in a conjunction that holds no term yet. Can be null.
        /// </param>
        /// <param name="maxGroups">
        /// The maximum number of conjunctions, or a value of zero or less to leave
        /// the number unlimited.
        /// </param>
        /// <param name="compact">
        /// A value indicating whether the read state clips the expression to a single
        /// line. Enabled by default, because a wrapping expression makes the row
        /// heights of a table depend on the complexity of one cell.
        /// </param>
        public RestApiTableColumnTemplateDnf(bool editable = false, string placeholder = null, int maxGroups = -1, bool compact = true)
        {
            Editable = editable;
            Placeholder = placeholder;
            MaxGroups = maxGroups;
            Compact = compact;
        }

        /// <summary>
        /// Collects the options the client-side dnf renderer reads. The terms are
        /// embedded as a JSON string, which the renderer parses.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["placeholder"] = Placeholder,
            ["maxGroups"] = MaxGroups > 0 ? MaxGroups : null,
            ["compact"] = Compact ? null : "false",
            ["options"] = ToEmbeddedJson((Items ?? []).Select(x => new
            {
                id = x.Id,
                label = x.Text,
                color = x.Color
            }))
        };
    }
}
