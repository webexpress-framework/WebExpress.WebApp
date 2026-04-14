using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a dashboard widget chart for use with REST API dashboard 
    /// components, providing properties for the chart's value and 
    /// display label.
    /// </summary>
    public class RestApiDashboardWidgetChart : RestApiDashboardWidget
    {
        /// <summary>
        /// Gets or sets the widget id.
        /// </summary>
        public override string Id => "widget_chart";

        /// <summary>
        /// Gets or sets the type of chart to be rendered.
        /// </summary>
        [JsonPropertyName("chartType")]
        public string ChartType { get; set; }

        /// <summary>
        /// Gets or sets the data payload associated with this instance.
        /// </summary>
        [JsonPropertyName("data")]
        public string Data { get; set; }

        /// <summary>
        /// Gets or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                var dict = new Dictionary<string, string>();
                if (!string.IsNullOrEmpty(Title)) { dict["title"] = Title; }
                if (!string.IsNullOrEmpty(ChartType)) { dict["chartType"] = ChartType; }
                if (!string.IsNullOrEmpty(Data)) { dict["data"] = Data; }
                return dict;
            }
            set
            {
                if (value != null)
                {
                    if (value.TryGetValue("title", out var t)) { Title = t; }
                    if (value.TryGetValue("chartType", out var ct)) { ChartType = ct; }
                    if (value.TryGetValue("data", out var d)) { Data = d; }
                }
            }
        }
    }
}
