using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the uri attribute of the corresponding table row in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTableRowUriAttribute : Attribute
    {
        /// <summary>
        /// Specifies the uri attribute of a table row in a REST API response.
        /// </summary>
        public RestTableRowUriAttribute()
        {
        }
    }
}
