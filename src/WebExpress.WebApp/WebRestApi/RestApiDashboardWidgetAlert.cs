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
        /// Gets or sets the widget id.
        /// </summary>
        public override string Id => "widget_alerts";

        /// <summary>
        /// Gets or sets the collection of alert messages associated with 
        /// the current context.
        /// </summary>
        [JsonPropertyName("alerts")]
        public List<string> Alerts { get; set; }

        /// <summary>
        /// Gets or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                var dict = new Dictionary<string, string>();
                if (Alerts is not null)
                {
                    dict["alerts"] = System.Text.Json.JsonSerializer.Serialize(Alerts ?? []);
                }
                if (!string.IsNullOrEmpty(Title))
                {
                    dict["title"] = Title;
                }

                return dict;
            }
            set
            {
                if (value is not null)
                {
                    if (value.TryGetValue("title", out var t)) { Title = t; }
                }

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
