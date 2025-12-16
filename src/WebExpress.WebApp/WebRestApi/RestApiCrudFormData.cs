using System.Collections.Generic;

namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Represents a collection of key-value pairs for storing arbitrary data associated with a payload.
    /// </summary>
    /// <remarks>
    /// The Payload class extends Dictionary<string, object>, allowing dynamic storage of values of
    /// any type, indexed by string keys. This is useful for scenarios where flexible, schema-less 
    /// data is required, such as passing metadata or extensible properties between components.
    /// </remarks>
    public class RestApiCrudFormData : Dictionary<string, object>
    {
    }
}
