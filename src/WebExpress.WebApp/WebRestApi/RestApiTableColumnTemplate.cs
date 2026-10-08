using System.Collections.Generic;
using System.Text.Json;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Base class for the table column templates of the REST table. A
    /// template travels as <c>{ type, options }</c> in the column payload and
    /// is rendered by the client-side template registry
    /// (<c>webexpress.webui.TableTemplates</c>), so a derived class only
    /// names its type and contributes the options its renderer reads.
    /// </summary>
    public abstract class RestApiTableColumnTemplate : IRestApiTableColumnTemplate
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public abstract string Type { get; }

        /// <summary>
        /// Gets a value indicating whether the current object can be edited.
        /// </summary>
        public bool Editable { get; protected set; }

        /// <summary>
        /// Collects the options the client-side renderer of the template
        /// reads. The keys are the camelCase option names of the renderer.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected abstract IDictionary<string, object> CreateOptions();

        /// <summary>
        /// Serializes the current object to its JSON string representation.
        /// </summary>
        /// <returns>
        /// A string containing the JSON representation of the object.
        /// </returns>
        public string ToJson()
        {
            var obj = new
            {
                type = Type,
                options = CreateOptions()
            };

            return JsonSerializer.Serialize(obj, _jsonOptions);
        }

        /// <summary>
        /// Serializes a value into an embedded JSON string, used for option
        /// values that the client-side renderer parses out of the options
        /// (for example the item list of a selection).
        /// </summary>
        /// <param name="value">The value to serialize.</param>
        /// <returns>The JSON string.</returns>
        protected static string ToEmbeddedJson(object value)
        {
            return JsonSerializer.Serialize(value, _jsonOptions);
        }
    }
}
