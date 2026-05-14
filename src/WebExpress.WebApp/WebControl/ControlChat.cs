using System;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Renders the host element for the chat overlay. The actual messages
    /// are delivered live by the server through the MessageQueue WebSocket
    /// (see <c>WebExpress.WebApp.WebMessageQueue.ChatMessageHandler</c>)
    /// and rendered by the client-side
    /// <c>webexpress.webapp.ChatCtrl</c>.
    /// </summary>
    public class ControlChat : Control
    {
        /// <summary>
        /// Gets or sets the channel id this control connects to. The same
        /// id is used for group chats (shared between every participant)
        /// and for 1:1 direct chats (typically derived from the sorted
        /// user ids of both partners).
        /// </summary>
        public Func<IRenderControlContext, string> ChannelId { get; set; }

        /// <summary>
        /// Gets or sets the local user's id (echoed on outgoing messages
        /// so peers can identify the sender).
        /// </summary>
        public Func<IRenderControlContext, string> UserId { get; set; }

        /// <summary>
        /// Gets or sets the local user's display name.
        /// </summary>
        public Func<IRenderControlContext, string> UserName { get; set; }

        /// <summary>
        /// Gets or sets the local user's color (used to tint the avatar
        /// chip in the message list).
        /// </summary>
        public Func<IRenderControlContext, string> UserColor { get; set; }

        /// <summary>
        /// Gets or sets the chat mode hint — <c>group</c> for many-to-many
        /// channels, <c>direct</c> for 1:1 conversations. Used only by the
        /// JS for cosmetic decisions; routing is always driven by
        /// <see cref="ChannelId"/>.
        /// </summary>
        public Func<IRenderControlContext, string> Mode { get; set; }

        /// <summary>
        /// Gets or sets the placeholder text rendered into the input box
        /// while empty.
        /// </summary>
        public Func<IRenderControlContext, string> Placeholder { get; set; }

        /// <summary>
        /// Gets or sets the channel title displayed at the top of the
        /// chat container.
        /// </summary>
        public Func<IRenderControlContext, string> Title { get; set; }

        /// <summary>
        /// Initializes a new instance.
        /// </summary>
        /// <param name="id">Optional host element id.</param>
        public ControlChat(string id = null)
            : base(id)
        {
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
            if (!enable)
            {
                return null;
            }

            return new HtmlElementTextContentDiv()
            {
                Id = Id,
                Class = Css.Concatenate("wx-webapp-chat", GetClasses()),
                Style = GetStyles(),
                Role = Role?.Invoke(renderContext)
            }
                .AddUserAttribute("data-chat-channel-id", ChannelId?.Invoke(renderContext))
                .AddUserAttribute("data-chat-user-id", UserId?.Invoke(renderContext))
                .AddUserAttribute("data-chat-user-name", UserName?.Invoke(renderContext))
                .AddUserAttribute("data-chat-user-color", UserColor?.Invoke(renderContext))
                .AddUserAttribute("data-chat-mode", Mode?.Invoke(renderContext))
                .AddUserAttribute("data-chat-placeholder", Placeholder?.Invoke(renderContext))
                .AddUserAttribute("data-chat-title", Title?.Invoke(renderContext));
        }
    }
}
