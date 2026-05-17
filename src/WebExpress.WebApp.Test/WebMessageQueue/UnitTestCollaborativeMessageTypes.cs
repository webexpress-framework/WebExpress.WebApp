using WebExpress.WebApp.WebMessageQueue;

namespace WebExpress.WebApp.Test.WebMessageQueue
{
    /// <summary>
    /// Tests for <see cref="CollaborativeMessageTypes"/>.
    /// </summary>
    public class UnitTestCollaborativeMessageTypes
    {
        /// <summary>
        /// Verifies that every well known collaborative type identifier shares
        /// the common prefix. This is the contract relied on by
        /// <see cref="MessageQueueSocket"/> to dispatch traffic to the handler.
        /// </summary>
        [Fact]
        public void Constants_ShareCommonPrefix()
        {
            Assert.StartsWith(CollaborativeMessageTypes.Prefix, CollaborativeMessageTypes.Presence);
            Assert.StartsWith(CollaborativeMessageTypes.Prefix, CollaborativeMessageTypes.Cursor);
            Assert.StartsWith(CollaborativeMessageTypes.Prefix, CollaborativeMessageTypes.Input);
            Assert.StartsWith(CollaborativeMessageTypes.Prefix, CollaborativeMessageTypes.Caret);
        }

        /// <summary>
        /// Verifies that the constants match the identifiers documented for the
        /// client-side <c>CollaborativeCtrl</c>. A change here would break
        /// browser/server interoperability.
        /// </summary>
        [Fact]
        public void Constants_MatchDocumentedIdentifiers()
        {
            Assert.Equal("webexpress.webapp.collaborative.presence", CollaborativeMessageTypes.Presence);
            Assert.Equal("webexpress.webapp.collaborative.cursor", CollaborativeMessageTypes.Cursor);
            Assert.Equal("webexpress.webapp.collaborative.input", CollaborativeMessageTypes.Input);
            Assert.Equal("webexpress.webapp.collaborative.caret", CollaborativeMessageTypes.Caret);
        }

        /// <summary>
        /// Confirms that <see cref="CollaborativeMessageTypes.IsCollaborative"/>
        /// recognizes every documented collaborative type.
        /// </summary>
        [Theory]
        [InlineData("webexpress.webapp.collaborative.presence")]
        [InlineData("webexpress.webapp.collaborative.cursor")]
        [InlineData("webexpress.webapp.collaborative.input")]
        [InlineData("webexpress.webapp.collaborative.caret")]
        [InlineData("webexpress.webapp.collaborative.future-extension")]
        public void IsCollaborative_ReturnsTrue_ForCollaborativeTypes(string type)
        {
            Assert.True(CollaborativeMessageTypes.IsCollaborative(type));
        }

        /// <summary>
        /// Confirms that unrelated message types are not classified as
        /// collaborative traffic.
        /// </summary>
        [Theory]
        [InlineData("webexpress.webapp.change.status")]
        [InlineData("update")]
        [InlineData("webexpress.webapp.collaborativex.cursor")]
        [InlineData("webexpress.webui.collaborative.cursor")]
        [InlineData("WEBEXPRESS.WEBAPP.COLLABORATIVE.CURSOR")]
        public void IsCollaborative_ReturnsFalse_ForUnrelatedTypes(string type)
        {
            Assert.False(CollaborativeMessageTypes.IsCollaborative(type));
        }

        /// <summary>
        /// Null and empty type identifiers must be rejected without throwing.
        /// </summary>
        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void IsCollaborative_ReturnsFalse_ForNullOrEmpty(string type)
        {
            Assert.False(CollaborativeMessageTypes.IsCollaborative(type));
        }
    }
}
