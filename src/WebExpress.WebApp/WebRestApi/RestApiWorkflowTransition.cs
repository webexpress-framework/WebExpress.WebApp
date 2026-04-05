using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a transition between workflow states in a REST API workflow 
    /// definition. Contains metadata and configuration for the transition, 
    /// including source and target states, visual attributes, and associated 
    /// workflow logic.
    /// </summary>
    public class RestApiWorkflowTransition
    {
        /// <summary>
        /// Returns or sets the unique identifier for the entity.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Returns or sets the sender of the message.
        /// </summary>
        [JsonPropertyName("from")]
        public string From { get; set; }

        /// <summary>
        /// Returns or sets the recipient address for the message.
        /// </summary>
        [JsonPropertyName("to")]
        public string To { get; set; }

        /// <summary>
        /// Returns or sets the color value associated with the object.
        /// </summary>
        [JsonPropertyName("color")]
        public string Color { get; set; }

        /// <summary>
        /// Returns or sets the dash pattern used for rendering lines.
        /// </summary>
        [JsonPropertyName("dasharray")]
        public string DashArray { get; set; }

        /// <summary>
        /// Returns or sets the collection of waypoints that define the workflow sequence.
        /// </summary>
        [JsonPropertyName("waypoints")]
        public List<RestApiWorkflowWaypoint> Waypoints { get; set; }

        /// <summary>
        /// Returns or sets the display label associated with the object.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }

        /// <summary>
        /// Returns or sets the description associated with this instance.
        /// </summary>
        [JsonPropertyName("description")]
        public string Description { get; set; }

        /// <summary>
        /// Returns or sets the form associated with the current object.
        /// </summary>
        [JsonPropertyName("form")]
        public string Form { get; set; }

        /// <summary>
        /// Returns or sets the collection of workflow guards that define conditions for workflow execution.
        /// </summary>
        [JsonPropertyName("guards")]
        public IEnumerable<RestApiWorkflowGuard> Guards { get; set; }

        /// <summary>
        /// Returns or sets the collection of validators associated with the workflow.
        /// </summary>
        [JsonPropertyName("validators")]
        public IEnumerable<RestApiWorkflowValidator> Validators { get; set; }

        /// <summary>
        /// Returns or sets the collection of post functions associated with the workflow transition.
        /// </summary>
        [JsonPropertyName("postfunctions")]
        public IEnumerable<RestApiWorkflowPostFunction> PostFunctions { get; set; }
    }
}
