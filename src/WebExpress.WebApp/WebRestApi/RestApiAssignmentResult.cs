using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the assignment state of an object as every method of the assignee
    /// endpoint answers it. A write answers the state it left behind, so the control
    /// redraws from the server's view and never from what it asked for.
    /// </summary>
    public class RestApiAssignmentResult
    {
        /// <summary>
        /// Gets or sets the assignee of the object, or <see langword="null"/> when the object
        /// is unassigned.
        /// </summary>
        [JsonPropertyName("assignee")]
        public RestApiAssignmentItem Assignee { get; set; }

        /// <summary>
        /// Gets or sets the person calling the endpoint, or <see langword="null"/> for an
        /// anonymous caller. The control offers "assign to me" or "unassign" by comparing it
        /// with the assignee.
        /// </summary>
        [JsonPropertyName("self")]
        public RestApiAssignmentItem Self { get; set; }

        /// <summary>
        /// Gets or sets a value indicating whether the caller may change the assignment. The
        /// control offers no action without it, because the endpoint would refuse the change
        /// anyway.
        /// </summary>
        [JsonPropertyName("mayChange")]
        public bool MayChange { get; set; }
    }
}
