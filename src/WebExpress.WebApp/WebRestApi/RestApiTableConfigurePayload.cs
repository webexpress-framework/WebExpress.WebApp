using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload received by <see cref="RestApiTable{TIndexItem}.Configure"/>
    /// when the user reconfigures the table layout on the client side.
    /// </summary>
    public class RestApiTableConfigurePayload
    {
        /// <summary>
        /// Gets or sets the ordered list of column updates. The position in the
        /// list defines the display order of the column.
        /// </summary>
        [JsonPropertyName("c")]
        public IList<RestApiTableColumnUpdate> Columns { get; set; }

        /// <summary>
        /// Gets or sets the ordered list of row identifiers reflecting the
        /// user-defined row sequence.
        /// </summary>
        [JsonPropertyName("r")]
        public IList<string> Rows { get; set; }
    }
}
