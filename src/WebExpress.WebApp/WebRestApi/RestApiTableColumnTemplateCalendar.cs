using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "calendar" for REST API
    /// table rendering, providing configuration options such as the date
    /// format, color and placeholder text. Unlike the date template, the
    /// edit mode opens a calendar picker.
    /// </summary>
    public class RestApiTableColumnTemplateCalendar : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "calendar";

        /// <summary>
        /// Gets the date format the renderer displays and parses.
        /// </summary>
        public string Format { get; private set; }

        /// <summary>
        /// Gets the text color associated with the template.
        /// </summary>
        public TypeColorText Color { get; private set; }

        /// <summary>
        /// Gets the placeholder text to display when the input field is empty.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="format">
        /// The date format the renderer displays and parses.
        /// </param>
        /// <param name="color">
        /// The text color to apply to the column.
        /// </param>
        /// <param name="placeholder">
        /// The placeholder text to display when the column value is empty. Can be null.
        /// </param>
        public RestApiTableColumnTemplateCalendar(bool editable = false, string format = "yyyy-MM-dd", TypeColorText color = TypeColorText.Default, string placeholder = null)
        {
            Editable = editable;
            Format = format;
            Color = color;
            Placeholder = placeholder;
        }

        /// <summary>
        /// Collects the options the client-side calendar renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["format"] = Format,
            ["colorCss"] = new PropertyColorText(Color).ToClass(),
            ["placeholder"] = Placeholder
        };
    }
}
