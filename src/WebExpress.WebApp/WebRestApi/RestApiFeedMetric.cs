using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One figure shown at the foot of a feed entry - how many people liked it, how many replied,
    /// how often it was read.
    /// </summary>
    /// <remarks>
    /// It is an icon and a number rather than named fields, because what is worth counting differs
    /// per feed and a control that knew about likes and comments would be wrong for the next one.
    /// The label is what a reader hears rather than sees: the figures sit in a row without
    /// captions, so the icon has to be explained to anyone not looking at it.
    /// </remarks>
    public class RestApiFeedMetric
    {
        /// <summary>
        /// Gets or sets the css class of the icon shown before the figure.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the figure itself, already formatted.
        /// </summary>
        [JsonPropertyName("value")]
        public string Value { get; set; }

        /// <summary>
        /// Gets or sets what the figure counts, as assistive text.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the endpoint a click on the figure posts to, which makes it something the
        /// reader can join rather than only read. Null leaves the figure a figure.
        /// </summary>
        /// <remarks>
        /// The endpoint <b>toggles</b> and answers <c>{ "value": "7", "active": true }</c> - the
        /// new count and whether the caller is now among it - so the figure repaints itself from
        /// the answer instead of the whole feed being re-queried over one click.
        /// </remarks>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the body posted to <see cref="Uri"/>, already serialized. It names what is
        /// being acted on, because the endpoint of a feed is one endpoint for every entry.
        /// </summary>
        [JsonPropertyName("payload")]
        public string Payload { get; set; }

        /// <summary>
        /// Gets or sets whether the calling identity is already counted in this figure - has
        /// liked, has subscribed. It is what the figure is drawn as, not just what it says.
        /// </summary>
        [JsonPropertyName("active")]
        public bool Active { get; set; }
    }
}
