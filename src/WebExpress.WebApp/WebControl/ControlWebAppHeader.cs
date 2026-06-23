using System.Collections.Generic;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the header bar at the top of a WebApp page, holding the title, navigation, help, and more.
    /// </summary>
    public class ControlWebAppHeader : Control, IControlWebAppHeader
    {
        /// <summary>
        /// Gets or sets the text color.
        /// </summary>
        public new virtual PropertyColorNavbar TextColor
        {
            get => (PropertyColorNavbar)GetPropertyObject();
            set => SetProperty(value, (renderContext) => value?.ToClass(), (renderContext) => value?.ToStyle());
        }

        /// <summary>
        /// Gets or sets whether the arrangement is fixed.
        /// </summary>
        public virtual TypeFixed Fixed
        {
            get => (TypeFixed)GetProperty(TypeFixed.None);
            set => SetProperty(value, (renderContext) => value.ToClass());
        }

        /// <summary>
        /// Gets or sets the fixed arrangement when the toolbar is at the top.
        /// </summary>
        public virtual TypeSticky Sticky
        {
            get => (TypeSticky)GetProperty(TypeSticky.None);
            set => SetProperty(value, (renderContext) => value.ToClass());
        }

        /// <summary>
        /// Gets or sets the application navigator.
        /// </summary>
        public IControlWebAppHeaderAppNavigator AppNavigator { get; } = new ControlWebAppHeaderAppNavigator("wx-header-appnavigator")
        {
        };

        /// <summary>
        /// Gets or setss the name of the application.
        /// </summary>
        public IControlWebAppHeaderAppTitle AppTitle { get; } = new ControlWebAppHeaderAppTitle("wx-header-apptitle")
        {
        };

        /// <summary>
        /// Gets or sets the navigation of the application.
        /// </summary>
        public IControlWebAppHeaderAppNavigation AppNavigation { get; } = new ControlWebAppHeaderAppNavigation("wx-header-appnavigation")
        {
        };

        /// <summary>
        /// Gets or sets the quick create.
        /// </summary>
        public IControlWebAppHeaderQuickCreate QuickCreate { get; } = new ControlWebAppHeaderQuickCreate("wx-header-quickcreate")
        {
        };

        /// <summary>
        /// Gets or sets the search of the application.
        /// </summary>
        public IControlWebAppHeaderSearch Search { get; } = new ControlWebAppHeaderSearch("wx-header-search")
        {
        };

        /// <summary>
        /// Gets or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderHelp Help { get; } = new ControlWebAppHeaderHelp("wx-header-help")
        {
        };

        /// <summary>
        /// Gets or sets the navigation of the application helpers.
        /// </summary>
        public IControlWebAppHeaderNotification Notifications { get; } = new ControlWebAppHeaderNotification("wx-header-notifications")
        {
        };

        /// <summary>
        /// Gets or sets the avatar of the application settings.
        /// </summary>
        public IControlWebAppHeaderAvatar Avatar { get; } = new ControlWebAppHeaderAvatar("wx-header-avatar")
        {
        };

        /// <summary>
        /// Gets or sets the navigation of the application settings.
        /// </summary>
        public IControlWebAppHeaderSettings Settings { get; } = new ControlWebAppHeaderSettings("wx-header-settings")
        {
        };

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeader(string id = null)
            : base(id)
        {
            Fixed = TypeFixed.Top;
            Styles = new List<string>(["position: sticky; top: 0; z-index: 99;"]);
            Padding = _ => new PropertySpacingPadding(PropertySpacing.Space.Null);
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var role = Role?.Invoke(renderContext);

            var content = new ControlPanelFlex()
            {
                Layout = _ => TypeLayoutFlex.Default,
                Align = _ => TypeAlignFlex.Center
            }
             .Add(AppNavigator)
             .Add(AppTitle)
             .Add(AppNavigation)
             .Add(QuickCreate)
             .Add(Search)
             .Add(new ControlPanel() { Margin = _ => new PropertySpacingMargin(PropertySpacing.Space.Auto, PropertySpacing.Space.None) })
             .Add(Help)
             .Add(Notifications)
             .Add(Avatar)
             .Add(Settings);

            return new HtmlElementSectionHeader(content.Render(renderContext, visualTree))
            {
                Id = Id,
                Class = Css.Concatenate("navbar", GetClasses(renderContext)),
                Style = Style.Concatenate("display: block;", GetStyles(renderContext)),
                Role = role
            };
        }
    }
}
