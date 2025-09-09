using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// App title for a web app.
    /// </summary>
    public class ControlWebAppHeaderAppTitle : ControlLink, IControlWebAppHeaderAppTitle
    {
        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlWebAppHeaderAppTitle(string id = null)
            : base(id)
        {
            Decoration = TypeTextDecoration.None;
        }

        /// <summary>
        /// Sets the title of the web application header.
        /// </summary>
        /// <param name="title">
        /// The title to display in the web application header. Cannot be null or empty.
        /// </param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlWebAppHeaderAppTitle SetTitle(string title)
        {
            Title = title;

            return this;
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var apptitle = new ControlText()
            {
                Text = I18N.Translate(renderContext.Request.Culture, renderContext.PageContext?.ApplicationContext?.ApplicationName),
                Format = TypeFormatText.H1,
                Padding = new PropertySpacingPadding(PropertySpacing.Space.One),
                Margin = new PropertySpacingMargin(PropertySpacing.Space.None, PropertySpacing.Space.Two, PropertySpacing.Space.None, PropertySpacing.Space.Null)
            };

            return new HtmlElementTextSemanticsA(apptitle.Render(renderContext, visualTree))
            {
                Id = Id,
                Href = renderContext?.PageContext?.ApplicationContext?.Route?.ToString(),
                Class = Css.Concatenate("", GetClasses()),
                Style = Style.Concatenate("", GetStyles()),
                Role = Role
            };
        }
    }
}
