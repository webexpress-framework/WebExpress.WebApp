using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using WebExpress.WebApp.WebCollaboration;
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
        /// Gets or sets the scope of the shared documents in the container.
        /// </summary>
        /// <remarks>
        /// Every control inside that shares a document (rich text editor, graph editor, WQL
        /// prompt) is edited concurrently as the document "scope/element id", with changes
        /// exchanged as operations and sequenced by the server. The scope names what is edited,
        /// typically a record ("ticket-42"), so everyone working on the same record meets in
        /// the same documents no matter which page they opened it from. When unset, the path and
        /// query of the rendered page together with the container id are used. The container
        /// carries a token signed for exactly this scope; only pages the server rendered for a
        /// user grant access to its documents.
        /// </remarks>
        public Func<IRenderControlContext, string> Document { get; set; }

        /// <summary>
        /// Gets or sets whether the shared documents are only followed, not changed.
        /// </summary>
        public Func<IRenderControlContext, bool> ReadOnly { get; set; } = _ => false;

        /// <summary>
        /// Gets or sets the id of the comment control whose backend keeps the texts of the
        /// comments anchored in the shared documents.
        /// </summary>
        /// <remarks>
        /// A shared rich text document then holds comment anchors only, and the comments
        /// themselves live where comments are managed anyway - with their author, replies and
        /// reactions - instead of being copied into a document every collaborator edits.
        /// </remarks>
        public Func<IRenderControlContext, string> Comments { get; set; }

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
            var scope = DocumentScope(renderContext);
            var token = CollaborativeAccess.CreateToken(scope, !(ReadOnly?.Invoke(renderContext) ?? false));

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
                .AddUserAttribute("data-collaborative-document", scope)
                .AddUserAttribute("data-collaborative-token", token)
                .AddUserAttribute("data-collaborative-comments", Comments?.Invoke(renderContext))
                .Add(Controls.Select(x => x.Render(renderContext, visualTree)));

            return html;
        }

        /// <summary>
        /// Determines the scope of the shared documents. An overlong scope is replaced by its
        /// hash, which keeps document ids within the length the server accepts.
        /// </summary>
        /// <param name="renderContext">The context in which the control is rendered.</param>
        /// <returns>The scope.</returns>
        private string DocumentScope(IRenderControlContext renderContext)
        {
            var scope = Document?.Invoke(renderContext);

            if (string.IsNullOrEmpty(scope))
            {
                var page = renderContext?.Uri?.ToString() ?? "";

                if (Uri.TryCreate(page, UriKind.Absolute, out var absolute))
                {
                    page = absolute.PathAndQuery;
                }

                scope = page + "#" + Id;
            }

            return scope.Length <= 300
                ? scope
                : "h:" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(scope)));
        }
    }
}
