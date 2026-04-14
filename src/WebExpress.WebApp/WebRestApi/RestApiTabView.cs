using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a tab view configuration for a REST API, including display 
    /// and identification properties.
    /// </summary>
    public class RestApiTabView : IRestApiTabView
    {
        /// <summary>
        /// Gets or sets the unique identifier for the tab view.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the name associated with the object.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the name or path of the icon associated with this instance.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the identifier of the template associated with this instance.
        /// </summary>
        [JsonPropertyName("templateId")]
        public string TemplateId { get; set; }

        /// <summary>
        /// Gets or sets the URI associated with this instance.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }
    }
}
