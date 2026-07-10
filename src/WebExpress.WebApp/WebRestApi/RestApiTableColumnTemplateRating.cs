using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a table column template of type "rating" for REST API
    /// table rendering: a star rating in read-only mode and an interactive
    /// star picker in edit mode.
    /// </summary>
    public class RestApiTableColumnTemplateRating : RestApiTableColumnTemplate
    {
        /// <summary>
        /// Gets the type identifier associated with the current instance.
        /// </summary>
        public override string Type => "rating";

        /// <summary>
        /// Gets the number of stars the rating spans.
        /// </summary>
        public uint Stars { get; private set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editable">
        /// A value indicating whether the column is editable.
        /// </param>
        /// <param name="stars">
        /// The number of stars the rating spans.
        /// </param>
        public RestApiTableColumnTemplateRating(bool editable = false, uint stars = 5)
        {
            Editable = editable;
            Stars = stars;
        }

        /// <summary>
        /// Collects the options the client-side rating renderer reads.
        /// </summary>
        /// <returns>The options of the template.</returns>
        protected override IDictionary<string, object> CreateOptions() => new Dictionary<string, object>
        {
            ["editable"] = Editable,
            ["stars"] = Stars
        };
    }
}
