using System.Collections.Generic;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a separator option in a REST API.
    /// </summary>
    public class RestApiOptionHeader : RestApiOption
    {
        private string _label = "";

        /// <summary>
        /// Gets the type of the element, represented as a string.
        /// </summary>
        public virtual string Type => "header";

        /// <summary>
        /// Gets or sets the text.
        /// </summary>
        public virtual string Text
        {
            get { return I18N.Translate(Request, _label); }
            set { _label = value; }
        }

        /// <summary>
        /// Gets or sets the icon.
        /// </summary>
        public virtual string Icon { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOptionHeader(IRequest request)
            : base(request)
        {
        }

        /// <summary>
        /// Returns a string that represents the current object, formatted 
        /// according to the specified action type.
        /// </summary>
        /// <returns>
        /// A string representation of the current object, formatted based 
        /// on the provided action type.
        /// </returns>
        public override Dictionary<string, object> ToJson()
        {
            var json = base.ToJson();
            json["type"] = Type;
            json["text"] = Text;

            if (!string.IsNullOrWhiteSpace(Icon))
            {
                json["icon"] = Icon;
            }

            return json;
        }
    }
}
