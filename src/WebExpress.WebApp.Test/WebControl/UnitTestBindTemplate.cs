using WebExpress.WebCore.WebHtml;
using WebExpress.WebApp.WebControl;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the BindTemplate binding class.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestBindTemplate
    {
        /// <summary>
        /// Tests that empty keys are ignored.
        /// </summary>
        [Fact]
        public void EmptyKeysAreIgnored()
        {
            // arrange
            var div = new HtmlElementTextContentDiv();
            var bind = new BindTemplate()
                .Add(null)
                .Add("")
                .Add("   ");

            // act
            bind.ApplyUserAttributes(div);

            // assert
            Assert.Equal("<div></div>", div.ToString().Trim());
        }

        /// <summary>
        /// Tests that data-wx-bind contains all keys in insertion order.
        /// </summary>
        [Fact]
        public void ApplyUserAttributesRendersKeyList()
        {
            // arrange
            var div = new HtmlElementTextContentDiv();
            var bind = new BindTemplate()
                .Add("uri")
                .Add("title")
                .Add("isActive");

            // act
            bind.ApplyUserAttributes(div);

            // assert
            Assert.Contains("data-wx-bind=\"uri, title, isActive\"", div.ToString());
        }

        /// <summary>
        /// Tests that non-default per-key metadata attributes are rendered.
        /// </summary>
        [Fact]
        public void ApplyUserAttributesRendersPerKeyOptions()
        {
            // arrange
            var div = new HtmlElementTextContentDiv();
            var bind = new BindTemplate()
                .Add("uri", TypeBindMode.Attr, ".wx-webapp-dashboard", "data-uri")
                .Add("isActive", TypeBindMode.Toggle, ".card", "active")
                .Add("title", TypeBindMode.Text, "self", "");

            // act
            bind.ApplyUserAttributes(div);

            // assert
            var html = div.ToString();
            Assert.Contains("data-wx-bind-uri-mode=\"attr\"", html);
            Assert.Contains("data-wx-bind-uri-target=\".wx-webapp-dashboard\"", html);
            Assert.Contains("data-wx-bind-uri-name=\"data-uri\"", html);

            Assert.Contains("data-wx-bind-isActive-mode=\"toggle\"", html);
            Assert.Contains("data-wx-bind-isActive-target=\".card\"", html);
            Assert.Contains("data-wx-bind-isActive-name=\"active\"", html);

            Assert.DoesNotContain("data-wx-bind-title-mode", html);
            Assert.DoesNotContain("data-wx-bind-title-target", html);
            Assert.DoesNotContain("data-wx-bind-title-name", html);
        }

        /// <summary>
        /// Tests that removing a key updates the rendered bindings.
        /// </summary>
        [Fact]
        public void RemoveKeyUpdatesBindingAttributes()
        {
            // arrange
            var div = new HtmlElementTextContentDiv();
            var bind = new BindTemplate()
                .Add("uri", TypeBindMode.Attr, null, "href")
                .Add("title");

            // act
            bind.Remove("uri").ApplyUserAttributes(div);

            // assert
            var html = div.ToString();
            Assert.Contains("data-wx-bind=\"title\"", html);
            Assert.DoesNotContain("data-wx-bind-uri-mode", html);
            Assert.DoesNotContain("data-wx-bind-uri-name", html);
            Assert.DoesNotContain("data-wx-bind-uri-target", html);
        }

        /// <summary>
        /// Tests JSON output structure and default normalization.
        /// </summary>
        [Fact]
        public void ToJsonContainsExpectedStructure()
        {
            // arrange
            var bind = new BindTemplate()
                .Add("uri", TypeBindMode.Attr, ".x", "data-uri")
                .Add("title");

            // act
            var json = bind.ToJson();

            // assert
            Assert.Equal("uri, title", json["bind"]);

            var keys = Assert.IsType<string[]>(json["keys"]);
            Assert.Equal(["uri", "title"], keys);

            var options = Assert.IsAssignableFrom<System.Collections.IDictionary>(json["options"]);
            Assert.True(options.Contains("uri"));
            Assert.True(options.Contains("title"));
        }
    }
}
