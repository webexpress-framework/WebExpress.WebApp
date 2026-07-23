using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload of a put request to update the dashboard / kanban
    /// layout. Depending on <see cref="Action"/> it carries either the widget /
    /// card arrangement (<see cref="Layout"/>) or the column layout
    /// (<see cref="Columns"/>, used for renaming, reordering and deleting
    /// columns).
    /// </summary>
    public class RestApiDashboardLayout
    {
        /// <summary>
        /// Gets or sets the kind of update. <c>"columns"</c> indicates a column
        /// layout change (rename / reorder / delete) carried in
        /// <see cref="Columns"/>.
        /// </summary>
        [JsonPropertyName("action")]
        public string Action { get; set; }

        /// <summary>
        /// Gets or sets the layout configuration (widget / card arrangement per column).
        /// </summary>
        [JsonPropertyName("layout")]
        public List<RestApiDashboardLayoutColumn> Layout { get; set; }

        /// <summary>
        /// Gets or sets the full ordered column list when the action is
        /// <c>"columns"</c>. The order represents the new column order; a renamed
        /// column carries the new title; a deleted column is omitted.
        /// </summary>
        [JsonPropertyName("columns")]
        public List<RestApiLayoutColumn> Columns { get; set; }

        /// <summary>
        /// Gets or sets the full board - columns with their widgets including the
        /// per-widget name, color and params - sent when a widget is added,
        /// deleted or reconfigured. Null for arrangement-only or column updates.
        /// </summary>
        [JsonPropertyName("board")]
        public List<RestApiDashboardBoardColumn> Board { get; set; }
    }
}
