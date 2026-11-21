using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a form a transition may show before it runs, as offered to the workflow
    /// editor's form picker.
    /// </summary>
    /// <remarks>
    /// The editor stores the chosen entry's <see cref="Id"/> on the transition
    /// (<see cref="RestApiWorkflowTransition.Form"/>), so the label only has to be readable;
    /// which forms qualify is decided by the source that lists them.
    /// </remarks>
    public class RestApiWorkflowForm
    {
        /// <summary>
        /// Gets or sets the identifier the transition refers to the form by.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }

        /// <summary>
        /// Gets or sets the name the picker shows for the form.
        /// </summary>
        [JsonPropertyName("label")]
        public string Label { get; set; }
    }
}
