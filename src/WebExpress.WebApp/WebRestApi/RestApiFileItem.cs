using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents one file of a REST API file operation.
    /// </summary>
    /// <remarks>
    /// The size and the date travel as display strings rather than as a byte
    /// count and a timestamp, because only the server knows the culture the page
    /// is rendered in. This also keeps a file that arrives through the API
    /// indistinguishable from one the server rendered into the page directly.
    /// <see cref="RestApiFile{TIndexItem}"/> offers the formatting helpers.
    /// </remarks>
    public class RestApiFileItem
    {
        /// <summary>
        /// Gets or sets the item id, which is how an update names the file it
        /// changes.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name of the file, including its extension.
        /// </summary>
        /// <remarks>
        /// The name is also the identity of the file across its versions: the
        /// client folds the items that share a name into one entry, the highest
        /// version at the head.
        /// </remarks>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the version of the file, which orders it among the other
        /// items of the same name. Zero means the file has one version only.
        /// </summary>
        [JsonPropertyName("version")]
        public int Version { get; set; }

        /// <summary>
        /// Gets or sets the address the file is downloaded from.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets an optional icon css class. Without one the client types
        /// the file by its extension.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets an optional preview image url, which replaces the icon.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the size of the file, formatted for display.
        /// </summary>
        [JsonPropertyName("size")]
        public string Size { get; set; }

        /// <summary>
        /// Gets or sets the date of the file, formatted for display.
        /// </summary>
        [JsonPropertyName("date")]
        public string Date { get; set; }

        /// <summary>
        /// Gets or sets the description of the file.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }
    }
}
