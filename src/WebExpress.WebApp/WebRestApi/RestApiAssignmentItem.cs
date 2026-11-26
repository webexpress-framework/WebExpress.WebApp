using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a person as the assignment endpoint exposes it and the client-side
    /// <c>webexpress.webapp.AssignmentCtrl</c> renders it: the assignee of an object or the
    /// person calling the endpoint.
    /// </summary>
    public class RestApiAssignmentItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the person. The control compares it with the
        /// id of the caller to decide between assigning and unassigning.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the person.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the uri of the portrait. When absent, the initials stand in for it.
        /// </summary>
        [JsonPropertyName("image")]
        public string Image { get; set; }

        /// <summary>
        /// Gets or sets the text shown in place of a missing portrait, typically one or two
        /// characters. When absent, the first letters of the first two words of the name are
        /// used.
        /// </summary>
        [JsonPropertyName("initials")]
        public string Initials { get; set; }
    }
}
