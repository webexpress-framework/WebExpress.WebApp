namespace WebExpress.WebApp.WebPackage
{
    /// <summary>
    /// Represents an operation result for package management actions.
    /// </summary>
    public sealed class PluginPackageOperationResult
    {
        /// <summary>
        /// Gets a value indicating whether the operation succeeded.
        /// </summary>
        public bool Success { get; private set; }

        /// <summary>
        /// Gets the message associated with the operation.
        /// </summary>
        public string Message { get; private set; }

        /// <summary>
        /// Creates a successful operation result.
        /// </summary>
        /// <param name="message">The result message.</param>
        /// <returns>The operation result.</returns>
        public static PluginPackageOperationResult Ok(string message)
        {
            return new PluginPackageOperationResult()
            {
                Success = true,
                Message = message
            };
        }

        /// <summary>
        /// Creates a failed operation result.
        /// </summary>
        /// <param name="message">The result message.</param>
        /// <returns>The operation result.</returns>
        public static PluginPackageOperationResult Failed(string message)
        {
            return new PluginPackageOperationResult()
            {
                Success = false,
                Message = message
            };
        }
    }
}
