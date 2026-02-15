using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Indicates that the decorated property represents the text attribute in a REST API response.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestTextAttribute : Attribute
    {
        /// <summary>
        /// Specifies the name of a property in a REST API response.
        /// </summary>
        public RestTextAttribute()
        {
        }
    }
}
