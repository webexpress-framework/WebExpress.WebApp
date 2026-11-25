using System;
using System.Linq;

namespace WebExpress.WebApp.WebMessageQueue
{
    /// <summary>
    /// Decides who may post to, read the history of and receive the messages of a chat channel.
    /// </summary>
    /// <remarks>
    /// The message queue carried every chat message to every client of the application and
    /// replayed the history of any channel a client named, direct messages included; the
    /// receivers filtered by channel themselves. Messages now reach only the clients whose
    /// signed-in caller may access the channel, and a client may only post to and read such a
    /// channel.
    ///
    /// By default a channel named <c>direct:{id}:{id}...</c> belongs to the identities it names,
    /// and every other channel is open to every signed-in caller of the application. An
    /// application whose channels have members of their own sets <see cref="CanAccess"/>.
    /// </remarks>
    public static class ChatChannelAccess
    {
        /// <summary>
        /// The prefix of a channel that belongs to the identities it names.
        /// </summary>
        public const string DirectPrefix = "direct:";

        /// <summary>
        /// Gets or sets the rule deciding whether an identity may access a channel. It receives the
        /// id of the signed-in caller - never null - and the channel id.
        /// </summary>
        public static Func<string, string, bool> CanAccess { get; set; } = Default;

        /// <summary>
        /// Tells whether a caller may access a channel; a caller who is not signed in may not.
        /// </summary>
        /// <param name="identityId">The id of the signed-in caller, or null.</param>
        /// <param name="channelId">The channel id.</param>
        /// <returns>True when the caller may access the channel.</returns>
        public static bool IsAllowed(string identityId, string channelId)
        {
            return !string.IsNullOrEmpty(identityId) && !string.IsNullOrEmpty(channelId)
                && (CanAccess ?? Default)(identityId, channelId);
        }

        /// <summary>
        /// The default rule: a direct channel for the identities it names, any other channel for
        /// every signed-in caller.
        /// </summary>
        /// <param name="identityId">The id of the signed-in caller.</param>
        /// <param name="channelId">The channel id.</param>
        /// <returns>True when the caller may access the channel.</returns>
        public static bool Default(string identityId, string channelId)
        {
            if (!channelId.StartsWith(DirectPrefix, StringComparison.Ordinal))
            {
                return true;
            }

            return channelId[DirectPrefix.Length..]
                .Split(':', StringSplitOptions.RemoveEmptyEntries)
                .Contains(identityId, StringComparer.Ordinal);
        }
    }
}
