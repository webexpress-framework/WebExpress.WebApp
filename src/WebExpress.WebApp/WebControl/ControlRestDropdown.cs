using System.Linq;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebApiControl
{
    /// <summary>
    /// Represents a dropdown control that can be rendered as HTML within a RESTful web application context.
    /// </summary>
    public class ControlRestDropdown : ControlDropdown
    {
        /// <summary>
        /// Returns or sets the REST API endpoint used to populate the dropdown.
        /// </summary>
        public IUri RestUri { get; set; }

        /// <summary>
        /// Returns or sets the maximum number of entries to display (default 25).
        /// </summary>
        public int MaxItems { get; set; } = -1;

        /// <summary>
        /// Returns or sets the placeholder text for the search input.
        /// </summary>
        public string SearchPlaceholder { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlRestDropdown(string id = null)
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
            var applicationContext = renderContext?.PageContext?.ApplicationContext;

            // respect enabled state
            if (!Enable)
            {
                return null;
            }

            var buttonCss = "";
            var buttonStyle = "";
            var menuCss = "";

            if (Color != null)
            {
                buttonCss = Css.Concatenate(Color?.ToClass(Outline), buttonCss);
                buttonStyle = Style.Concatenate(Color?.ToStyle(), buttonStyle);
            }

            if (Size != TypeSizeButton.Default)
            {
                buttonCss = Css.Concatenate(Size.ToClass(), buttonCss);
            }

            if (Block != TypeBlockButton.None)
            {
                buttonCss = Css.Concatenate(Block.ToClass(), buttonCss);
            }

            if (Toggle != TypeToggleDropdown.None)
            {
                buttonCss = Css.Concatenate(Toggle.ToClass(), buttonCss);
            }

            if (AlignmentMenu != TypeAlignmentDropdownMenu.Default)
            {
                menuCss = Css.Concatenate(AlignmentMenu.ToClass(), menuCss);
            }

            // create host element for the remote dropdown controller
            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-dropdown", GetClasses()),
                Style = GetStyles()
            }
                .AddUserAttribute("data-label", I18N.Translate(renderContext, Text))
                .AddUserAttribute("data-icon", (Icon as Icon)?.Class)
                .AddUserAttribute("data-image", (Icon as ImageIcon)?.Uri?.ToString())
                .AddUserAttribute("data-buttonCss", buttonCss)
                .AddUserAttribute("data-buttonStyle", buttonStyle)
                .AddUserAttribute("data-menuCss", menuCss)
                .AddUserAttribute("data-uri", RestUri?.ToString())
                .AddUserAttribute("data-maxItems", MaxItems > 0 ? MaxItems.ToString() : null)
                .AddUserAttribute("data-searchPlaceholder", I18N.Translate(renderContext, SearchPlaceholder))
                .AddUserAttribute(Active == TypeActive.Active ? "active" : null)
                .AddUserAttribute(Active == TypeActive.Disabled ? "disabled" : null)
                .Add(Items.Select(x => x?.Render(renderContext, visualTree)));

            return html;
        }
    }
}