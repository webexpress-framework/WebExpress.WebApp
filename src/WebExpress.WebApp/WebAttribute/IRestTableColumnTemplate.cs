using System.Text.Json.Serialization;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Defines the contract for a table column template used in REST API responses, 
    /// specifying the column type and whether the column is editable.
    /// </summary>
    [JsonConverter(typeof(RestTableColumnTemplateJsonConverter))]
    public interface IRestTableColumnTemplate
    {
        /// <summary>
        /// Returns the type identifier associated with the current instance.
        /// </summary>
        string Type { get; }

        /// <summary>
        /// Returns a value indicating whether the current object can be edited.
        /// </summary>
        bool Editable { get; }

        /// <summary>
        /// Serializes the current object to its JSON string representation.
        /// </summary>
        /// <returns>
        /// A string containing the JSON representation of the object.
        /// </returns>
        string ToJson();
    }
}
