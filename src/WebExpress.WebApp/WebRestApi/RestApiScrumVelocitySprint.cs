using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a single past sprint together with its committed and completed
    /// story points, as exposed by the REST API and rendered by the client-side
    /// <c>webexpress.webapp.ScrumVelocityCtrl</c>. The completed points are the
    /// sprint's velocity.
    /// </summary>
    public class RestApiScrumVelocitySprint
    {
        /// <summary>
        /// Gets or sets the unique identifier of the sprint.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the display name of the sprint, used as the bar label.
        /// </summary>
        [JsonPropertyName("name")]
        public string Name { get; set; }

        /// <summary>
        /// Gets or sets the story points committed for the sprint, rendered as the
        /// backdrop bar.
        /// </summary>
        [JsonPropertyName("committed")]
        public int Committed { get; set; }

        /// <summary>
        /// Gets or sets the story points completed in the sprint. This is the
        /// sprint's velocity and the value the average is taken over.
        /// </summary>
        [JsonPropertyName("completed")]
        public int Completed { get; set; }
    }
}
