using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests action serialization and html attributes for plugin package actions.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestActionPluginPackage
    {
        /// <summary>
        /// Tests json conversion with defaults.
        /// </summary>
        [Fact]
        public void ToJson_Defaults()
        {
            // arrange
            var action = new ActionPluginPackage(new UriEndpoint("/api/v1/pluginpackage"));

            // act
            var json = action.ToJson();

            // validate
            Assert.Equal("plugin-package", json["action"]);
            Assert.Equal("/api/v1/pluginpackage", json["uri"]);
            Assert.Equal("POST", json["method"]);
        }

        /// <summary>
        /// Tests json conversion with optional attributes.
        /// </summary>
        [Fact]
        public void ToJson_Options()
        {
            // arrange
            var action = new ActionPluginPackage(new UriEndpoint("/api/v1/pluginpackage/id/update"), "PUT", true)
            {
                ConfirmText = "confirm"
            };

            // act
            var json = action.ToJson();

            // validate
            Assert.Equal("plugin-package", json["action"]);
            Assert.Equal("PUT", json["method"]);
            Assert.Equal(true, json["requireFile"]);
            Assert.Equal("confirm", json["confirm"]);
        }

        /// <summary>
        /// Tests html attribute rendering for primary action.
        /// </summary>
        [Fact]
        public void ApplyUserAttributes_Primary()
        {
            // arrange
            var action = new ActionPluginPackage(new UriEndpoint("/api/v1/pluginpackage/id"), "DELETE")
            {
                ConfirmText = "delete"
            };
            var node = new HtmlElementTextContentDiv();

            // act
            action.ApplyUserAttributes(node, TypeAction.Primary);
            var html = node.ToString();

            // validate
            Assert.Contains(@"data-wx-primary-action=""plugin-package""", html);
            Assert.Contains(@"data-wx-primary-uri=""/api/v1/pluginpackage/id""", html);
            Assert.Contains(@"data-wx-primary-method=""DELETE""", html);
            Assert.Contains(@"data-wx-primary-confirm=""delete""", html);
        }
    }
}
