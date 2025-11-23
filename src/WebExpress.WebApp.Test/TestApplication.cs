using WebExpress.WebCore.WebApplication;
using WebExpress.WebCore.WebAttribute;

namespace WebExpress.WebApp.Test
{
    /// <summary>
    /// A dummy application for testing purposes.
    /// </summary>
    [Name("TestApplication")]
    [Description("application.description")]
    [Icon("/assets/img/Logo.png")]
    [ContextPath("/app")]
    [AssetPath("/asset")]
    [DataPath("/data")]
    public sealed class TestApplication : IApplication
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="applicationContext">The application context, for testing the injection.</param>
        private TestApplication(IApplicationContext applicationContext)
        {
            // test the injection
            if (applicationContext is null)
            {
                throw new ArgumentNullException(nameof(applicationContext), "Parameter cannot be null or empty.");
            }
        }

        /// <summary>
        /// Called when the plugin starts working. The call is concurrent.
        /// </summary>
        public void Run()
        {
        }

        /// <summary>
        /// Release of unmanaged resources reserved during use.
        /// </summary>
        public void Dispose()
        {
        }
    }
}
