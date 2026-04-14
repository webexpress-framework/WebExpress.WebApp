using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents the content control for a web application.
    /// </summary>
    public class ControlWebAppContent : Control, IControlWebAppContent
    {
        /// <summary>
        /// Gets the toolbar.
        /// </summary>
        public IControlWebAppToolbar Toolbar { get; } = new ControlWebAppToolbar("wx-content-toolbar");

        /// <summary>
        /// Gets the main panel.
        /// </summary>
        public IControlWebAppMain MainPanel { get; } = new ControlWebAppMain("wx-content-main")
        {
            //BackgroundColor = new PropertyColorBackground(TypeColorBackground.Danger),
        };

        /// <summary>
        /// Gets the page properties.
        /// </summary>
        public IControlWebAppProperty Property { get; } = new ControlWebAppProperty("wx-content-property");

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppContent(string id = null)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {

            //if (Property)
            var split = new ControlPanelSplit("wx-splitter-content")
            {
                Orientation = TypeOrientationSplit.Horizontal,
                SidePanelInitialSize = 350,
                SidePanelMinSize = 150,
                Order = TypeSplitOrder.MainSide

            }
             .AddMainPanel(MainPanel)
             .AddSidePanel(Property);


            var contentCtlr = new ControlPanel(Id)
            {
                Classes = ["wx-content"]
            }
                .Add(Toolbar)
                .Add(split);

            return contentCtlr?.Render(renderContext, visualTree);
        }
    }
}
