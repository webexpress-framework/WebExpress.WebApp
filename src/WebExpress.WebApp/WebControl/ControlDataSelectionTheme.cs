using System;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Theme picker that lists the themes registered for the request's
    /// application and lets the user switch between them at runtime.
    /// <para>
    /// Unlike the original form-item variant, this control is a standalone
    /// dropdown (<see cref="ControlDropdown"/>) that does not need to live
    /// inside a <see cref="ControlForm"/>. The dropdown shell is emitted as
    /// <c>wx-webapp-dropdown-theme</c> wired to the supplied <c>RestUri</c>;
    /// the JS layer (<c>webexpress.webapp.DropdownTheme</c>) fetches the
    /// theme list on initialisation, marks the currently active theme as the
    /// dropdown's label, and persists a user pick through
    /// <c>PUT v=&lt;themeId&gt;</c> followed by a page reload so the server
    /// re-resolves <c>VisualTreeControl.Theme</c> against the cookie that the
    /// REST endpoint just wrote.
    /// </para>
    /// <para>
    /// Exactly one theme is always selected: the server reports the active
    /// theme via the GET response's <c>selected</c> field, the JS layer
    /// mirrors that as the dropdown label, and the user can only switch to a
    /// different theme - never to "no theme".
    /// </para>
    /// </summary>
    public class ControlDataSelectionTheme : ControlDropdown, IControlData
    {
        /// <summary>
        /// REST URI exposing a <c>RestApiTheme</c>-compatible endpoint
        /// (GET returns the theme list, PUT/POST stores the selection).
        /// </summary>
        public Func<IRenderControlContext, IUri> RestUri { get; set; }

        /// <summary>
        /// Initializes a new instance of the class with an automatically
        /// assigned id.
        /// </summary>
        public ControlDataSelectionTheme()
            : this(null)
        {
        }

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The control id.</param>
        public ControlDataSelectionTheme(string id)
            : base(id)
        {
        }

        /// <summary>
        /// Converts the control to an HTML representation. Promotes the
        /// dropdown shell to the theme-specific class so the JS controller
        /// registered under <c>wx-webapp-dropdown-theme</c> picks it up and
        /// attaches the REST URI as <c>data-uri</c>.
        /// </summary>
        /// <param name="renderContext">The rendering context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An html node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var restUri = RestUri?.Invoke(renderContext)?.BindParameters(renderContext?.Request);

            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dropdown-theme")
                .RemoveClass("wx-webui-dropdown")
                .AddUserAttribute("data-uri", restUri?.ToString());

            return html;
        }
    }
}
