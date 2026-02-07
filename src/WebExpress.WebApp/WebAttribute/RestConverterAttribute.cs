using System;
using WebExpress.WebApp.WebRestApi;

namespace WebExpress.WebApp.WebAttribute
{
    /// <summary>
    /// Specifies the REST value converter to use for a property during serialization and
    /// deserialization.
    /// </summary>
    /// <typeparam name="TRestConverter">
    /// The type of the REST value converter to associate with the property.
    /// </typeparam>
    [AttributeUsage(AttributeTargets.Property, AllowMultiple = false, Inherited = true)]
    public class RestConverterAttribute<TRestConverter> : Attribute
        where TRestConverter : IRestValueConverter
    {
        /// <summary>
        /// Returns the converter type used for REST serialization or deserialization operations.
        /// </summary>
        public Type ConverterType { get; }

        /// <summary>
        /// Initializes a new instance of the class using the specified converter type.
        /// </summary>
        public RestConverterAttribute()
        {
            ConverterType = typeof(TRestConverter);
        }
    }
}
