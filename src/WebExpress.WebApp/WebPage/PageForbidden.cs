using WebExpress.WebCore.WebPage;

namespace WebExpress.WebApp.WebPage
{
    /// <summary>
    /// Represents a web application page that is displayed when access is forbidden.
    /// </summary>
    internal class PageForbidden : PageWebAppForbidden
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        public PageForbidden()
        {
        }

        /// <summary>
        /// Processing of the page.
        /// </summary>
        /// <param name="renderContext">The context for rendering the page.</param>
        /// <param name="visualTree">The visual tree control to be processed.</param>
        public override void Process(IRenderContext renderContext, VisualTreeWebApp visualTree)
        {
            base.Process(renderContext, visualTree);
        }
    }
}
