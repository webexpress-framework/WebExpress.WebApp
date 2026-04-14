using System.Collections.Generic;
using System.Text.Json;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "tag" for REST API table rendering, 
    /// providing configuration options such as color and placeholder text.
    /// </summary>
    public class RestApiTableColumnTemplateTag : IRestApiTableColumnTemplate
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public string Type => "tag";

        /// <summary>
        /// Gets a value indicating whether the current object can be edited.
        /// </summary>
        public bool Editable { get; private set; }

        /// <summary>
        /// Gets the color tag associated with the type.
        /// </summary>
        public TypeColorTag Color { get; private set; }

        /// <summary>
        /// Gets the placeholder text to display when the input field is empty.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class with the specified editability, color,
        /// and placeholder text.
        /// </summary>
        /// <param name="editabl">
        /// A value indicating whether the column is editable. Set to <see langword="true"/> 
        /// to allow editing; otherwise, <see langword="false"/>.
        /// </param>
        /// <param name="color">
        /// The color tag to apply to the column. Use TypeColorTag. Default for the default color.
        /// </param>
        /// <param name="placeholder">
        /// The placeholder text to display when the column value is empty. Can be null.
        /// </param>
        public RestApiTableColumnTemplateTag(bool editabl = false, TypeColorTag color = TypeColorTag.Default, string placeholder = null)
        {
            Editable = editabl;
            Color = color;
            Placeholder = placeholder;
        }

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
                options = new Dictionary<string, object>
                {
                    ["editable"] = Editable,
                    ["colorCss"] = Color.ToClass(),
                    ["placeholder"] = Placeholder
                }
            };

            var json = JsonSerializer.Serialize(obj, _jsonOptions);

            return json;
        }
    }
}
