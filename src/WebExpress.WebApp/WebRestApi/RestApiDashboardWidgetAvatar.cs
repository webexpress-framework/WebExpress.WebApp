using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Avatar/Person Widget ("w_avatar").
    /// </summary>
    public class RestApiDashboardWidgetAvatar : RestApiDashboardWidget
    {
        /// <summary>
        /// Gets or sets the widget id.
        /// </summary>
        public override string Id => "widget_avatar";

        /// <summary>
        /// Gets or sets the name associated with the object.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the caption text associated with the object.
        /// </summary>
        [JsonPropertyName("caption")]
        public string Caption { get; set; }

        /// <summary>
        /// Gets or sets the image associated with the entity.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

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
                if (!string.IsNullOrEmpty(Name)) { dict["name"] = Name; }
                if (!string.IsNullOrEmpty(Caption)) { dict["caption"] = Caption; }
                if (!string.IsNullOrEmpty(Image)) { dict["image"] = Image; }
                return dict;
            }
            set
            {
                if (value != null)
                {
                    if (value.TryGetValue("title", out var t)) { Title = t; }
                    if (value.TryGetValue("name", out var n)) { Name = n; }
                    if (value.TryGetValue("caption", out var cap)) { Caption = cap; }
                    if (value.TryGetValue("image", out var img)) { Image = img; }
                }
            }
        }
    }
}
