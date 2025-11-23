using System;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Defines the editor type for a property when displayed in a table column.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property, Inherited = false, AllowMultiple = false)]
    public sealed class RestTableColumnEditorAttribute : Attribute
    {
        /// <summary>
        /// Returns the editor type.
        /// </summary>
        public TypeRender Editor { get; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="editor">The editor type.</param>
        public RestTableColumnEditorAttribute(TypeRender editor)
        {
            Editor = editor;
        }
    }
}
