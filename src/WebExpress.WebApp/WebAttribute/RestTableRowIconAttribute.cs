using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the icon attribute of the corresponding table row in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTableRowIconAttribute : Attribute
    {
        /// <summary>
        /// Specifies the icon attribute of a table row in a REST API response.
        /// </summary>
        public RestTableRowIconAttribute()
        {
        }
    }
}
