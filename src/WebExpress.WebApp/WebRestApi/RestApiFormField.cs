namespace WebExpress.WebApp.WebRestApi
{
    /// <summary>
    /// Preserves update intent independently of the converted value.
    /// </summary>
    public enum RestApiFormFieldState
    {
        /// <summary>
        /// The request does not change this field.
        /// </summary>
        Missing,
        /// <summary>
        /// The request explicitly clears this field.
        /// </summary>
        Empty,
        /// <summary>
        /// The request supplies a convertible value.
        /// </summary>
        Valid,
        /// <summary>
        /// The request supplies an invalid value.
        /// </summary>
        Invalid
    }

    /// <summary>
    /// Exposes conversion failures without conflating them with removal.
    /// </summary>
    /// <typeparam name="T">The requested value type.</typeparam>
    /// <param name="State">The submission state.</param>
    /// <param name="Value">The converted value, when valid.</param>
    /// <param name="Error">The validation explanation, when invalid.</param>
    public sealed record RestApiFormField<T>(RestApiFormFieldState State, T Value = default, string Error = null);
}
