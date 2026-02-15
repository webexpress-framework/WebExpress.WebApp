using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the icon attribute of the corresponding dropdown in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestIconAttribute : Attribute
    {
        /// <summary>
        /// Specifies the icon attribute of a dropdown in a REST API response.
        /// </summary>
        public RestIconAttribute()
        {
        }
    }
}
