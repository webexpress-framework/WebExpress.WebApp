using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents the root DTO of a form structure exchanged with the visual
    /// form-editor (<c>ControlDataFormEditor</c> / <c>webexpress.webapp.RestFormEditorCtrl</c>).
    /// </summary>
    public class RestApiFormEditorItem
    {
        /// <summary>
        /// Gets or sets the stable identifier of the form.
        /// </summary>
        [JsonPropertyName("formId")]
        public string FormId { get; set; }

        /// <summary>
        /// Gets or sets the user-visible name of the form.
        /// </summary>
        [JsonPropertyName("formName")]
        public string FormName { get; set; }

        /// <summary>
        /// Gets or sets the user-visible description of the form.
        /// </summary>
        [JsonPropertyName("formDescription")]
        public string FormDescription { get; set; }

        /// <summary>
        /// Gets or sets the optional class name (target type) the form is bound to.
        /// </summary>
        [JsonPropertyName("className")]
        public string ClassName { get; set; }

        /// <summary>
        /// Gets or sets the structural version of the form, used for optimistic
        /// concurrency in the editor's save loop.
        /// </summary>
        [JsonPropertyName("version")]
        public int Version { get; set; }

        /// <summary>
        /// Gets or sets the revision of the unpublished draft the structure was
        /// edited on top of, sent by the editor with every draft save.
        /// </summary>
        /// <remarks>
        /// Draft saves do not move <see cref="Version"/> - nothing the forms in use
        /// see changes - so two editors drafting the same form could not tell each
        /// other's saves apart by it. The draft endpoint answers its own revision,
        /// and <see cref="RestApiFormEditorDraft{TIndexItem}"/> refuses a save that
        /// presents another one. Zero means the editor knew of no draft. It is not
        /// written when zero, so the structure the data endpoint answers is unchanged.
        /// </remarks>
        [JsonPropertyName("draftRevision")]
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
        public int DraftRevision { get; set; }

        /// <summary>
        /// Gets or sets the ordered list of tabs that compose the form.
        /// </summary>
        [JsonPropertyName("tabs")]
        public IEnumerable<RestApiFormEditorTabItem> Tabs { get; set; }
    }
}
