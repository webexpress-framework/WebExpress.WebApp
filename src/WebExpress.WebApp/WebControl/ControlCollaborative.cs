using System;
using System.Collections.Generic;
using System.Linq;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a collaborative host control that enables real-time presence,
    /// cursor and synchronized input behaviors via the collaborative JavaScript module.
    /// </summary>
    public class ControlCollaborative : Control, IControlCollaborative
    {
        private readonly List<IControl> _controls = [];

        /// <summary>
        /// Gets or sets a value indicating whether presence updates are enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Presence { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets a value indicating whether cursor synchronization is enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Cursor { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets a value indicating whether input synchronization is enabled.
        /// </summary>
        public Func<IRenderControlContext, bool> Input { get; set; } = _ => true;

        /// <summary>
        /// Gets or sets the color mode used by the collaborative controller.
        /// </summary>
        public Func<IRenderControlContext, string> ColorMode { get; set; }

        /// <summary>
        /// Gets or sets the user id used for collaborative messages.
        /// </summary>
        public Func<IRenderControlContext, string> UserId { get; set; }

        /// <summary>
        /// Gets or sets the display name of the local user.
        /// </summary>
        public Func<IRenderControlContext, string> UserName { get; set; }

        /// <summary>
        /// Gets or sets the user color used for presence and cursor visualization.
        /// </summary>
        public Func<IRenderControlContext, string> UserColor { get; set; }

        /// <summary>
        /// Gets or sets the resolver of the element id the presence bar is docked into.
        /// </summary>
        /// <remarks>
        /// Who is here is a fact about the whole surface rather than about the shared area they
        /// happen to point at, so a host with a better place for it - the footer bar of a dialog,
        /// say - names that place here. The cursors and the carets stay overlays of the container
        /// either way: they are positions inside it and mean nothing outside it.
        /// </remarks>
        public Func<IRenderControlContext, string> PresenceHost { get; set; }

        /// <summary>
        /// Returns the embedded controls rendered within the collaborative host.
        /// </summary>
        public virtual IEnumerable<IControl> Controls => _controls;

        /// <summary>
        /// Initializes a new instance of the class.
        /// </summary>
        /// <param name="id">The id of the control.</param>
        /// <param name="controls">The nested controls.</param>
        public ControlCollaborative(string id = null, params IControl[] controls)
            : base(id)
        {
            _controls.AddRange(controls);
        }

        /// <summary>
        /// Adds controls to the collaborative host.
        /// </summary>
        /// <param name="controls">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlCollaborative Add(params IControl[] controls)
        {
            _controls.AddRange(controls);
            return this;
        }

        /// <summary>
        /// Adds controls to the collaborative host.
        /// </summary>
        /// <param name="controls">The controls to add.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlCollaborative Add(IEnumerable<IControl> controls)
        {
            _controls.AddRange(controls);
            return this;
        }

        /// <summary>
        /// Removes a nested control from the collaborative host.
        /// </summary>
        /// <param name="control">The control to remove.</param>
        /// <returns>The current instance for method chaining.</returns>
        public virtual IControlCollaborative Remove(IControl control)
        {
            _controls.Remove(control);
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
            var role = Role?.Invoke(renderContext);
            var presence = Presence?.Invoke(renderContext) ?? true;
            var cursor = Cursor?.Invoke(renderContext) ?? true;
            var input = Input?.Invoke(renderContext) ?? true;
            var colorMode = ColorMode?.Invoke(renderContext);
            var userId = UserId?.Invoke(renderContext);
            var userName = UserName?.Invoke(renderContext);
            var userColor = UserColor?.Invoke(renderContext);
            var presenceHost = PresenceHost?.Invoke(renderContext);

            var html = new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-collaborative", GetClasses(renderContext)),
                Style = GetStyles(renderContext),
                Role = role
            }
                .AddUserAttribute("data-collaborative-presence", presence ? null : "false")
                .AddUserAttribute("data-collaborative-cursor", cursor ? null : "false")
                .AddUserAttribute("data-collaborative-input", input ? null : "false")
                .AddUserAttribute("data-collaborative-color-mode", colorMode)
                .AddUserAttribute("data-collaborative-user-id", userId)
                .AddUserAttribute("data-collaborative-user-name", userName)
                .AddUserAttribute("data-collaborative-color", userColor)
                .AddUserAttribute("data-collaborative-presence-host", presenceHost)
                .Add(Controls.Select(x => x.Render(renderContext, visualTree)));

            return html;
        }
    }
}
