using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single person working in the current sprint together with the
    /// story points assigned to them, as exposed by the REST API and rendered by
    /// the client-side <c>webexpress.webapp.ScrumTeamCtrl</c>.
    /// </summary>
    public class RestApiScrumTeamMember
    {
        /// <summary>
        /// Gets or sets the unique identifier of the person.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the person.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the optional team or role label of the person.
        /// </summary>
        [JsonPropertyName("team")]
        public string Team { get; set; }

        /// <summary>
        /// Gets or sets the short text shown inside the avatar bubble (typically
        /// one or two characters). When omitted, the client derives the initials
        /// from the name.
        /// </summary>
        [JsonPropertyName("initials")]
        public string Initials { get; set; }

        /// <summary>
        /// Gets or sets the CSS color string used as the avatar background.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Gets or sets the sum of story points planned (committed) for the
        /// person in the current sprint.
        /// </summary>
        [JsonPropertyName("points")]
        public int Points { get; set; }

        /// <summary>
        /// Gets or sets the sum of story points the person has already completed
        /// (status done) in the current sprint. Never exceeds <see cref="Points"/>.
        /// </summary>
        [JsonPropertyName("completed")]
        public int Completed { get; set; }
    }
}
