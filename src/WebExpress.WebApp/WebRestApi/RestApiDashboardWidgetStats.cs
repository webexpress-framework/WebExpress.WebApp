using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a dashboard widget that displays statistical 
    /// information such as title and uptime.
    /// </summary>
    public class RestApiDashboardWidgetStats : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_stats";

        /// <summary>
        /// Returns or sets the title associated with the object.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Returns or sets the duration for which the service or application has been running.
        /// </summary>
        [JsonPropertyName("uptime")]
        public string Uptime { get; set; }

        /// <summary>
        /// Returns or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                var dict = new Dictionary<string, string>();
                if (!string.IsNullOrEmpty(Title)) { dict["title"] = Title; }
                if (!string.IsNullOrEmpty(Uptime)) { dict["uptime"] = Uptime; }
                return dict;
            }
            set
            {
                if (value != null)
                {
                    if (value.TryGetValue("title", out var t)) { Title = t; }
                    if (value.TryGetValue("uptime", out var ut)) { Uptime = ut; }
                }
            }
        }
    }
}
