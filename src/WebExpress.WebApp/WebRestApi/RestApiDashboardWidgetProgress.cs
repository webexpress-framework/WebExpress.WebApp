using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a dashboard widget that displays progress information 
    /// with a value and an associated color.
    /// </summary>
    public class RestApiDashboardWidgetProgress : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_progress";

        /// <summary>
        /// Returns or sets the integer value associated with this instance.
        /// </summary>
        [JsonPropertyName("value")]
        public int Value { get; set; }

        /// <summary>
        /// Returns or sets the color used to display progress.
        /// </summary>
        [JsonPropertyName("color")]
        public string ProgressColor { get; set; }

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
                    ["value"] = Value.ToString()
                };
                if (!string.IsNullOrEmpty(ProgressColor)) { dict["color"] = ProgressColor; }
                return dict;
            }
            set
            {
                if (value != null)
                {
                    if (value.TryGetValue("value", out var v) && int.TryParse(v, out var i))
                    {
                        Value = i;
                    }
                    if (value.TryGetValue("color", out string value1))
                    {
                        ProgressColor = value1;
                    }
                }
            }
        }
    }
}
