using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Info/Bullet List Widget ("w_list").
    /// </summary>
    public class RestApiDashboardWidgetList : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_list";

        /// <summary>
        /// Returns or sets the collection of item names associated with the current instance.
        /// </summary>
        [JsonPropertyName("items")]
        public List<string> Items { get; set; }

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
                    ["items"] = System.Text.Json.JsonSerializer.Serialize(Items ?? new List<string>())
                };
                return dict;
            }
            set
            {
                if (value != null && value.TryGetValue("items", out var json))
                {
                    try
                    {
                        Items = System.Text.Json.JsonSerializer.Deserialize<List<string>>(json);
                    }
                    catch
                    {
                        // fallback
                        Items = [];
                    }
                }
            }
        }
    }
}
