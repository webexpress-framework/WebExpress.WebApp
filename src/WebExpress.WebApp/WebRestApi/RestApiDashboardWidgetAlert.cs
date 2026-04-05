using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a dashboard widget that displays a collection of alert 
    /// messages retrieved from a REST API.
    /// </summary>
    public class RestApiDashboardWidgetAlerts : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_alerts";

        /// <summary>
        /// Returns or sets the collection of alert messages associated with 
        /// the current context.
        /// </summary>
        [JsonPropertyName("alerts")]
        public List<string> Alerts { get; set; }

        /// <summary>
        /// Returns or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                // für Einfachheit als JSON-Array serialisieren
                var dict = new Dictionary<string, string>
                {
                    ["alerts"] = System.Text.Json.JsonSerializer.Serialize(Alerts ?? [])
                };
                return dict;
            }
            set
            {
                if (value != null && value.TryGetValue("alerts", out var json))
                {
                    try
                    {
                        Alerts = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                    }
                    catch
                    {
                        Alerts = [];
                    }
                }
            }
        }
    }
}
