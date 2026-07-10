using System.Collections.Generic;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "numeric" for REST API
    /// table rendering, providing configuration options such as color,
    /// placeholder text and the numeric range.
    /// </summary>
    public class RestApiTableColumnTemplateNumeric : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "numeric";

        /// <summary>
        /// Gets the text color associated with the template.
        /// </summary>
        public TypeColorText Color { get; private set; }

        /// <summary>
        /// Gets the placeholder text to display when the input field is empty.
        /// </summary>
        public string Placeholder { get; private set; }

        /// <summary>
        /// Gets the minimum value accepted in edit mode, or null for no limit.
        /// </summary>
        public double? Min { get; set; }

        /// <summary>
        /// Gets the maximum value accepted in edit mode, or null for no limit.
        /// </summary>
        public double? Max { get; set; }

        /// <summary>
        /// Gets the step of the numeric input in edit mode, or null for the default.
        /// </summary>
        public double? Step { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="color">
        /// The text color to apply to the column.
        /// </param>
        /// <param name="placeholder">
        /// The placeholder text to display when the column value is empty. Can be null.
        /// </param>
        public RestApiTableColumnTemplateNumeric(bool editable = false, TypeColorText color = TypeColorText.Default, string placeholder = null)
        {
            Editable = editable;
            Color = color;
            Placeholder = placeholder;
        }

        /// <summary>
        /// Collects the options the client-side numeric renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions()
        {
            var options = new Dictionary<string, object>
            {
                ["editable"] = Editable,
                ["colorCss"] = new PropertyColorText(Color).ToClass(),
                ["placeholder"] = Placeholder
            };

            if (Min.HasValue)
            {
                options["min"] = Min.Value;
            }
            if (Max.HasValue)
            {
                options["max"] = Max.Value;
            }
            if (Step.HasValue)
            {
                options["step"] = Step.Value;
            }

            return options;
        }
    }
}
