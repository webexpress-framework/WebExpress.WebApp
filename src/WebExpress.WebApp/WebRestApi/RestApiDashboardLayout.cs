using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the payload of a put request to update the dashboard layout.
    /// </summary>
    public class RestApiDashboardLayout
    {
        /// <summary>
        /// Returns or sets the layout configuration.
        /// </summary>
        [JsonPropertyName("layout")]
        public List<RestApiDashboardLayoutColumn> Layout { get; set; }
    }
}
