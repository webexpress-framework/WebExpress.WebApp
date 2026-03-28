using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Info Card Widget ("widget_info").
    /// </summary>
    public class RestApiDashboardWidgetInfo : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_info";

        /// <summary>
        /// Returns or sets the title associated with the object.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Returns or sets the description associated with this instance.
        /// </summary>
        [JsonPropertyName("desc")]
        public string Description { get; set; }

        /// <summary>
        /// Returns or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                var dict = new Dictionary<string, string>
                {
                    ["title"] = Title ?? string.Empty,
                    ["desc"] = Description ?? string.Empty
                };
                return dict;
            }
            set
            {
                // fill strongly-typed props if loaded from json
                if (value != null)
                {
                    if (value.TryGetValue("title", out string value1))
                    {
                        Title = value1;
                    }
                    if (value.TryGetValue("desc", out string value2))
                    {
                        Description = value2;
                    }
                }
            }
        }
    }
}
