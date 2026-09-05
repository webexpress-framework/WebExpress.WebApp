using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// One entry of a feed: a heading, a line of context under it, and a passage of the text it
    /// stands for.
    /// </summary>
    /// <remarks>
    /// It is deliberately not a <see cref="RestApiListItem"/>. A list row is one line that names
    /// something; a feed entry is a piece of writing shown in place, and the three parts a reader
    /// needs from it - what it is called, when it is from, and how it begins - are three separate
    /// fields rather than one <c>Text</c>. Folding them into a list row would leave every consumer
    /// re-splitting a string.
    /// </remarks>
    public class RestApiFeedItem
    {
        /// <summary>
        /// Gets or sets the id of the entry.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the heading of the entry.
        /// </summary>
        [JsonPropertyName("title")]
        public string Title { get; set; }

        /// <summary>
        /// Gets or sets the line of context shown under the heading - a date, an author, a
        /// category. It is rendered small and quiet, and may be null.
        /// </summary>
        [JsonPropertyName("meta")]
        public string Meta { get; set; }

        /// <summary>
        /// Gets or sets the text of the entry, or the passage of it the feed shows. Rich text is
        /// rendered as such; how much of it is sent is the endpoint's decision, not the control's.
        /// </summary>
        [JsonPropertyName("text")]
        public string Text { get; set; }

        /// <summary>
        /// Gets or sets the css class of the icon shown beside the heading. May be null.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the pictures of the entry, shown beside its text. May be null or empty.
        /// </summary>
        /// <remarks>
        /// It is a list rather than one picture because an entry that has several has them for a
        /// reason, and a teaser that showed only the first would be choosing on the author's
        /// behalf. More than one turns the teaser into a slideshow; the control decides that, so
        /// an endpoint just sends what the entry has.
        /// </remarks>
        [JsonPropertyName("images")]
        public IEnumerable<string> Images { get; set; }

        /// <summary>
        /// Gets or sets the address the entry leads to, which is what the whole entry links to.
        /// May be null, for a feed whose entries are read where they stand.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets the tags of the entry, shown under the text. May be null.
        /// </summary>
        [JsonPropertyName("tags")]
        public IEnumerable<string> Tags { get; set; }

        /// <summary>
        /// Gets or sets the figures shown at the foot of the entry, opposite the tags - how many
        /// liked it, how many replied. May be null.
        /// </summary>
        [JsonPropertyName("metrics")]
        public IEnumerable<RestApiFeedMetric> Metrics { get; set; }

        /// <summary>
        /// Gets or sets whether the calling identity has already read the entry, or
        /// <see langword="null"/> when the endpoint does not track that.
        /// </summary>
        /// <remarks>
        /// It is the <b>unread</b> ones the marker is for: somebody who follows a stream wants to
        /// see what is new to them, and decorating everything they have already read would mark
        /// the whole page. Three states rather than two, because "not read" and "not known" must
        /// not look alike - an endpoint that cannot tell leaves this null and the control draws no
        /// distinction at all, rather than calling every entry new.
        /// </remarks>
        [JsonPropertyName("read")]
        public bool? Read { get; set; }
    }
}
