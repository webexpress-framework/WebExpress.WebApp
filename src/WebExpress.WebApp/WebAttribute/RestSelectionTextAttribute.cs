using System;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the text attribute of the corresponding selection in a REST API for the decorated class.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false)]
    public class RestSelectionTextAttribute : Attribute
    {
        /// <summary>
        /// Specifies the text attribute of a selection in a REST API response.
        /// </summary>
        public RestSelectionTextAttribute()
        {
        }
    }
}
