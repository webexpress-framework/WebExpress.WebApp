using System;
using System.Collections.Generic;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebHtml;
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
    /// <c>wx-webapp-dropdown-theme</c> wired to the declared data service;
    /// the JS layer (<c>webexpress.webapp.DropdownThemeCtrl</c>) fetches the
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
    public class ControlDataSelectionTheme : ControlDropdown, IControlData, IDataIsland
    {
        /// <summary>
        /// Gets the data service descriptors of the control, emitted as
        /// wx-service island elements. The data service exposes a
        /// <c>RestApiTheme</c>-compatible endpoint (GET returns the theme list,
        /// PUT stores the selection).
        /// </summary>
        public IList<Func<IRenderControlContext, DataServiceDescriptor>> ServiceFactories { get; } = [];

        /// <summary>
        /// Gets or sets the single data service descriptor, as a convenience for
        /// the common control with exactly one service. Reading returns the
        /// first declared service, assigning replaces all declared services.
        /// </summary>
        public Func<IRenderControlContext, DataServiceDescriptor> ServiceFactory
        {
            get => ServiceFactories.Count > 0 ? ServiceFactories[0] : null;
            set
            {
                ServiceFactories.Clear();

                if (value != null)
                {
                    ServiceFactories.Add(value);
                }
            }
        }

        /// <summary>
        /// Gets or sets the optional template reference, emitted as the
        /// data-wx-template attribute.
        /// </summary>
        public Func<IRenderControlContext, string> TemplateFactory { get; set; }

        /// <summary>
        /// Gets or sets the optional initial state, emitted as the wx-state island.
        /// </summary>
        public Func<IRenderControlContext, DataState> StateFactory { get; set; }

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
        /// resolves the theme endpoint from the wx-service island.
        /// </summary>
        /// <param name="renderContext">The rendering context.</param>
        /// <param name="visualTree">The visual tree.</param>
        /// <returns>An html node representing the rendered control.</returns>
        public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
        {
            var html = base.Render(renderContext, visualTree)
                .AddClass("wx-webapp-dropdown-theme")
                .RemoveClass("wx-webui-dropdown")
                .EmitDataIslands(this, renderContext);

            return html;
        }
    }
}
