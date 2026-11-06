using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// A node of a REST-backed tree, as <see cref="RestApiTree{TIndexItem}"/> answers it level by level.
    /// </summary>
    public class RestApiTreeNode
    {
        /// <summary>
        /// Gets or sets the id, which the tree asks for the children with.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the label.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Gets or sets the icon: the css classes of an icon, or the address of a picture.
        /// </summary>
        [JsonPropertyName("icon")]
        public string Icon { get; set; }

        /// <summary>
        /// Gets or sets the address a click on the node opens, or null for a node that is only selected.
        /// </summary>
        [JsonPropertyName("uri")]
        public string Uri { get; set; }

        /// <summary>
        /// Gets or sets whether the node has children. The tree draws the indicator from it and
        /// asks for the children only when the node is opened, so it is no count.
        /// </summary>
        [JsonPropertyName("hasChildren")]
        public bool HasChildren { get; set; }

        /// <summary>
        /// Gets or sets whether items can be dropped into the node. A node that takes no children
        /// still takes siblings above and below it.
        /// </summary>
        [JsonPropertyName("droppable")]
        public bool Droppable { get; set; } = true;
    }
}
