using System;

namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Derives the stable wire name of a resource or service type, so the
    /// type-safe authoring surface (Service&lt;TService&gt;,
    /// Resource&lt;TResource&gt;) and the emitted islands agree on one identifier
    /// without the author ever writing a string. The full name is used because it
    /// is unique across namespaces; the name is internal to the island contract
    /// and the JavaScript engine resolves resources and services by it.
    /// </summary>
    public static class DataTypeName
    {
        /// <summary>
        /// Returns the stable wire name of a type.
        /// </summary>
        /// <typeparam name="T">The resource or service type.</typeparam>
        /// <returns>The stable name.</returns>
        public static string Of<T>()
        {
            return Of(typeof(T));
        }

        /// <summary>
        /// Returns the stable wire name of a type.
        /// </summary>
        /// <param name="type">The resource or service type.</param>
        /// <returns>The stable name.</returns>
        public static string Of(Type type)
        {
            return type?.FullName ?? type?.Name;
        }
    }
}
