using System.Collections.Generic;
using WebExpress.WebCore.WebMessage;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a separator option in a REST API.
    /// </summary>
    public class RestApiOptionSeperator : RestApiOption
    {
        /// <summary>
        /// Returns the type of the element, represented as a string.
        /// </summary>
        public virtual string Type => "divider";

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="request">The request object associated with the current operation.</param>
        public RestApiOptionSeperator(IRequest request)
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

            return json;
        }
    }
}
