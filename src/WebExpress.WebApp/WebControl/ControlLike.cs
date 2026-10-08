using System;
using WebExpress.WebCore.Internationalization;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebIcon;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// A like: how many have joined it, and a way for the reader to join it too.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The control posts to the address it is given and repaints itself from the answer, which
    /// the endpoint returns as <c>{ "value": "7", "active": true }</c> - the new count and
    /// whether the caller is among it. The count comes back from the server rather than being
    /// counted up in the browser: two readers clicking at once would otherwise each see their
    /// own click and neither the other's, and the number would drift from the one the next page
    /// load shows.
    /// </para>
    /// <para>
    /// <b>Without an address it is a figure, not a button.</b> That is the case for a reader who
    /// is not signed in - a like belongs to somebody - and offering the click only to answer 401
    /// is worse than not offering it. The same shape therefore serves both, and a surface does
    /// not have to choose between two controls depending on who is looking.
    /// </para>
    /// <para>
    /// Unlike most data-driven controls of this assembly, the value is rendered by the server
    /// rather than fetched by the client: the page already knows the count, so asking for it a
    /// second time would cost a round trip and show a figure that flickers into place. The
    /// client only adds the toggle. This is the same contract the feed wires into its own
    /// figures (<c>FeedCtrl._buildMetric</c>), lifted out of the feed so a server-rendered view
    /// can use it as well.
    /// </para>
    /// </remarks>
    public class ControlLike : Control
    {
        /// <summary>
        /// Gets or sets the number of likes shown. Defaults to zero.
        /// </summary>
        public Func<IRenderControlContext, int> Value { get; set; }

        /// <summary>
        /// Gets or sets whether the reader is among the count, which the control shows as its
        /// pressed state. Defaults to <c>false</c>.
        /// </summary>
        public Func<IRenderControlContext, bool> Active { get; set; }

        /// <summary>
        /// Gets or sets the address the toggle is posted to. Without one the control renders a
        /// figure that cannot be clicked.
        /// </summary>
        public Func<IRenderControlContext, IUri> Uri { get; set; }

        /// <summary>
        /// Gets or sets the json body naming what is being liked, for example
        /// <c>{"object":"SD-43011"}</c>. It is sent verbatim; the control does not know what the
        /// endpoint on the other end calls its subject.
        /// </summary>
        public Func<IRenderControlContext, string> Payload { get; set; }

        /// <summary>
        /// Gets or sets the accessible name of the figure, also shown as its tooltip.
        /// </summary>
        public Func<IRenderControlContext, string> Label { get; set; }

        /// <summary>
        /// Gets or sets the icon beside the number. Defaults to a thumbs-up.
        /// </summary>
        public Func<IRenderControlContext, IIcon> Icon { get; set; }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlLike(string id = null)
            : base(id ?? RandomId.Create())
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <param name="visualTree">The visual tree representing the control's structure.</param>
        /// <returns>An HTML node representing the rendered control, or null when disabled.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var enable = Enable?.Invoke(renderContext) ?? true;

            if (!enable)
            {
                return null;
            }

            var uri = Uri?.Invoke(renderContext)?.ToString();
            var actionable = !string.IsNullOrWhiteSpace(uri);
            var active = actionable && (Active?.Invoke(renderContext) ?? false);
            var label = I18N.Translate(renderContext, Label?.Invoke(renderContext));
            var icon = Icon?.Invoke(renderContext) ?? new IconThumbsUp();

            var value = new HtmlElementTextSemanticsSpan(new HtmlText((Value?.Invoke(renderContext) ?? 0).ToString()))
            {
                Class = "wx-webapp-like-value"
            };

            // the icon draws itself, so an icon set that renders as something other than a
            // class on an <i> keeps working here
            var glyph = icon?.Render(renderContext, visualTree, css: "wx-webapp-like-icon");

            // the number beside it already says what the figure is, and the button carries the
            // accessible name, so the glyph is decoration
            (glyph as IHtmlElement)?.AddUserAttribute("aria-hidden", "true");

            // a figure nobody can join is not a button: a control that looks pressable and does
            // nothing is worse than a plain number
            if (!actionable)
            {
                return new HtmlElementTextSemanticsSpan(value, glyph)
                {
                    Id = Id,
                    Class = Css.Concatenate("wx-webapp-like", GetClasses(renderContext)),
                    Style = GetStyles(renderContext)
                }
                    .AddUserAttribute("title", label)
                    .AddUserAttribute("aria-label", label);
            }

            return new HtmlElementFieldButton(value, glyph)
            {
                Id = Id,
                // wx-webapp-like-mount is the class the client control registers under and
                // the controller consumes on mount, so a later dom scan cannot instantiate a
                // second controller on the same figure. The styling hooks are deliberately
                // separate classes: the server already renders the finished figure, and a look
                // that arrived only once the script had run would flash into place
                Class = Css.Concatenate("wx-webapp-like", "wx-webapp-like-action", "wx-webapp-like-mount", active ? "wx-webapp-like-active" : null, GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Type = "button",
                Title = label
            }
                .AddUserAttribute("aria-label", label)
                .AddUserAttribute("aria-pressed", active ? "true" : "false")
                .AddUserAttribute("data-uri", uri)
                .AddUserAttribute("data-payload", Payload?.Invoke(renderContext));
        }
    }
}
