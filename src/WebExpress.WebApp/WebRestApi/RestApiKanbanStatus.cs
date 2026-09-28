using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Provides an application-defined workflow status for column assignment and card transitions.
    /// </summary>
    public class RestApiKanbanStatus
    {
        /// <summary>
        /// Gets or sets the stable workflow status identifier.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the localized display label used in status dialogs.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }
    }
}
