using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Abstract base class for tab children. Discriminated by the wire-format
    /// property <c>kind</c>, which <see cref="System.Text.Json"/> writes and
    /// reads automatically based on the <see cref="JsonDerivedTypeAttribute"/>
    /// declarations.
    /// </summary>
    [JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
    [JsonDerivedType(typeof(RestApiFormEditorFieldItem), "field")]
    [JsonDerivedType(typeof(RestApiFormEditorGroupItem), "group")]
    public abstract class RestApiFormEditorNodeItem
    {
        /// <summary>
        /// Gets or sets the unique identifier of the node.
        /// </summary>
        [JsonPropertyName("id")]
        public string Id { get; set; }
    }
}
