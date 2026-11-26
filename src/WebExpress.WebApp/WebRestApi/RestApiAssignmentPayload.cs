using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the body of an assign request issued by the assignment control.
    /// </summary>
    public class RestApiAssignmentPayload
    {
        /// <summary>
        /// Gets or sets the id of the person the object is assigned to. A missing id assigns
        /// the object to the caller, which is the common case of the "assign to me" action
        /// and spares the client from knowing its own id.
        /// </summary>
        [JsonPropertyName("userId")]
        public string UserId { get; set; }
    }
}
