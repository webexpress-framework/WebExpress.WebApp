using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the uri attribute of the corresponding selection in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestUriAttribute : Attribute
    {
        /// <summary>
        /// Specifies the uri attribute of a selection in a REST API response.
        /// </summary>
        public RestUriAttribute()
        {
        }
    }
}
