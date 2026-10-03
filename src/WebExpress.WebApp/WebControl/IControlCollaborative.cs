using System;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.WebControl
{
    /// <summary>
    /// Represents a collaborative control that synchronizes presence, cursor and input states.
    /// </summary>
    public interface IControlCollaborative : IControl
    {
        /// <summary>
        /// Gets or sets a value indicating whether presence updates are enabled.
        /// </summary>
        Func<IRenderControlContext, bool> Presence { get; }

        /// <summary>
        /// Gets or sets a value indicating whether cursor synchronization is enabled.
        /// </summary>
        Func<IRenderControlContext, bool> Cursor { get; }

        /// <summary>
        /// Gets or sets a value indicating whether input synchronization is enabled.
        /// </summary>
        Func<IRenderControlContext, bool> Input { get; }

        /// <summary>
        /// Gets or sets the color mode (e.g. auto).
        /// </summary>
        Func<IRenderControlContext, string> ColorMode { get; }

        /// <summary>
        /// Gets or sets the user id used for collaborative messages.
        /// </summary>
        Func<IRenderControlContext, string> UserId { get; }

        /// <summary>
        /// Gets or sets the display name of the local user.
        /// </summary>
        Func<IRenderControlContext, string> UserName { get; }

        /// <summary>
        /// Gets or sets the user color used for presence and cursor visualization.
        /// </summary>
        Func<IRenderControlContext, string> UserColor { get; }

        /// <summary>
        /// Gets or sets the resolver of the element id the presence bar is docked into, for a
        /// host that has a better place for "who is here" than an overlay of the shared area.
        /// </summary>
        Func<IRenderControlContext, string> PresenceHost { get; }
    }
}
