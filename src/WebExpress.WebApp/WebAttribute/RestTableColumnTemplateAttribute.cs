using System;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies a template file to be used for rendering a table column.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, Inherited = false, AllowMultiple = false)]
    public sealed class RestTableColumnTemplateAttribute : Attribute
    {
        /// <summary>
        /// Returns the template type.
        /// </summary>
        public TypeRender Template { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="template">The template type.</param>
        public RestTableColumnTemplateAttribute(TypeRender template)
        {
            Template = template;
        }
    }
}
