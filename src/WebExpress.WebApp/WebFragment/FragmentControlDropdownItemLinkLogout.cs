using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebFragment;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebFragment;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebFragment
{
    /// <summary>
    /// Represents a dropdown menu item that provides a logout link within a fragment control. This abstract class is
    /// intended to be used as a base for implementing logout functionality in dropdown navigation components.
    /// </summary>
    /// <remarks>
    /// This class sets default values for the logout label and icon. It extends the functionality of
    /// FragmentControlDropdownItemLink to specifically handle logout actions. Derived classes should implement any
    /// additional behavior required for logout scenarios.
    /// </remarks>
    public abstract class FragmentControlDropdownItemLinkLogout : FragmentControlDropdownItemLink
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="fragmentContext">The context in which the fragment is used.</param>
        public FragmentControlDropdownItemLinkLogout(IFragmentContext fragmentContext)
            : base(fragmentContext)
        {
            Text = "webexpress.webapp:logout.label";
            Icon = new IconPowerOff();
        }

        /// <summary>
        /// Convert the control to HTML.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public virtual IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree, IUri restUri)
        {
            if (!FragmentContext.Conditions.Check(renderContext?.Request))
            {
                return null;
            }

            var targetUri = renderContext.PageContext.ApplicationContext.Route.ToUri();
            var primaryAction = new ActionLogout(restUri, targetUri);

            return base.Render(renderContext, visualTree, Text, Tooltip, Icon, Color, Uri, Target, primaryAction, SecondaryAction);
        }
    }
}
