using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A further presentation of the relation surface, rendered as a pane the
    /// client shows when its token is the selected view. The pane carries its
    /// caption and its icon as data attributes, so the client builds the entry of
    /// the presentation switch from the pane itself and the page needs to declare
    /// the presentation only once.
    ///
    /// The pane is hidden on the server, so a surface that opens on another
    /// presentation never flashes this one before the client takes over.
    /// </summary>
    public class ControlDataRelationViewItem : Control, IControlDataRelationViewItem
    {
        private readonly List<IControl> _content = [];

        /// <summary>
        /// Gets the token the presentation is selected by.
        /// </summary>
        public string View { get; }

        /// <summary>
        /// Gets or sets the caption of the presentation in the switch.
        /// </summary>
        public Func<IRenderControlContext, string> Label { get; set; }

        /// <summary>
        /// Gets or sets the icon of the presentation in the switch.
        /// </summary>
        public Func<IRenderControlContext, IIcon> Icon { get; set; }

        /// <summary>
        /// Gets the content of the presentation.
        /// </summary>
        public IEnumerable<IControl> Content => _content;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="view">
        /// The token the presentation is selected by. It must not collide with
        /// the built-in <c>list</c> and <c>graph</c>.
        /// </param>
        /// <param name="id">Optional host element id.</param>
        public ControlDataRelationViewItem(string view, string id = null)
            : base(id)
        {
            View = view;
        }

        /// <summary>
        /// Adds one or more controls to the presentation.
        /// </summary>
        /// <param name="items">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataRelationViewItem Add(params IControl[] items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Adds one or more controls to the presentation.
        /// </summary>
        /// <param name="items">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public IControlDataRelationViewItem Add(IEnumerable<IControl> items)
        {
            _content.AddRange(items);

            return this;
        }

        /// <summary>
        /// Converts the control to its HTML representation.
        /// </summary>
        /// <param name="renderContext">The render context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>The rendered HTML node.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;

            if (!enable || string.IsNullOrWhiteSpace(View))
            {
                return null;
            }

            var icon = Icon?.Invoke(renderContext);
            var label = I18N.Translate(renderContext?.Request?.Culture, Label?.Invoke(renderContext));

            return new HtmlElementTextContentDiv(_content.Select(x => x.Render(renderContext, visualTree)).ToArray())
            {
                Id = Id,
                Class = Css.Concatenate("wx-relation-view-pane", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-view", View)
                .AddUserAttribute("data-label", string.IsNullOrEmpty(label) ? View : label)
                .AddUserAttribute("data-icon", (icon as Icon)?.Class)
                .AddUserAttribute("data-image", (icon as ImageIcon)?.Uri?.ToString())
                .AddUserAttribute("hidden", "hidden");
        }
    }
}
