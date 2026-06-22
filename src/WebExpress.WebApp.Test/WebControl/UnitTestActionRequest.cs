using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using Xunit;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests action serialization and html attributes for the request action.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestActionRequest
    {
        /// <summary>
        /// Tests json conversion with defaults.
        /// </summary>
        [Fact]
        public void ToJson_Defaults()
        {
            // arrange
            var action = new ActionRequest(new UriEndpoint("/api/v1/popuptrigger"));

            // act
            var json = action.ToJson();

            // validate
            Assert.Equal("request", json["action"]);
            Assert.Equal("/api/v1/popuptrigger", json["uri"]);
            Assert.Equal("GET", json["method"]);
        }

        /// <summary>
        /// Tests html attribute rendering for the primary action.
        /// </summary>
        [Fact]
        public void ApplyUserAttributes_Primary()
        {
            // arrange
            var action = new ActionRequest(new UriEndpoint("/api/v1/popuptrigger?scope=global"), "POST");
            var node = new HtmlElementTextContentDiv();

            // act
            action.ApplyUserAttributes(node, TypeAction.Primary);
            var html = node.ToString();

            // validate
            Assert.Contains(@"data-wx-primary-action=""request""", html);
            Assert.Contains(@"data-wx-primary-uri=""/api/v1/popuptrigger?scope=global""", html);
            Assert.Contains(@"data-wx-primary-method=""POST""", html);
        }

        /// <summary>
        /// Tests html attribute rendering for the secondary action.
        /// </summary>
        [Fact]
        public void ApplyUserAttributes_Secondary()
        {
            // arrange
            var action = new ActionRequest(new UriEndpoint("/api/v1/popuptrigger"));
            var node = new HtmlElementTextContentDiv();

            // act
            action.ApplyUserAttributes(node, TypeAction.Secondary);
            var html = node.ToString();

            // validate
            Assert.Contains(@"data-wx-secondary-action=""request""", html);
            Assert.Contains(@"data-wx-secondary-uri=""/api/v1/popuptrigger""", html);
            Assert.Contains(@"data-wx-secondary-method=""GET""", html);
        }
    }
}
