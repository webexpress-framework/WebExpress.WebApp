using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Big Number/KPI Widget ("w_bignumber").
    /// </summary>
    public class RestApiDashboardWidgetBigNumber : RestApiDashboardWidget
    {
        /// <summary>
        /// Returns or sets the widget id.
        /// </summary>
        public override string Id => "widget_bignumber";

        /// <summary>
        /// Returns or sets the value represented by this property.
        /// </summary>
        [JsonPropertyName("value")]
        public string Value { get; set; }

        /// <summary>
        /// Returns or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the additional widget parameters.
        /// </summary>
        [JsonPropertyName("params")]
        public override Dictionary<string, string> Params
        {
            get
            {
                var dict = new Dictionary<string, string>();
                if (!string.IsNullOrEmpty(Value)) { dict["value"] = Value; }
                if (!string.IsNullOrEmpty(Title)) { dict["title"] = Title; }
                if (!string.IsNullOrEmpty(Label)) { dict["label"] = Label; }
                return dict;
            }
            set
            {
                if (value is not null)
                {
                    if (value.TryGetValue("value", out var v)) { Value = v; }
                    if (value.TryGetValue("title", out var t)) { Title = t; }
                    if (value.TryGetValue("label", out var l)) { Label = l; }
                }
            }
        }
    }
}
