using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebRestApi;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebUI.WebControl;

namespace WebExpress.WebApp.Test.WebRestApi
{
    /// <summary>
    /// Provides unit tests for the REST sidebar endpoint, verifying the json
    /// contract the client sidebar model consumes.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestRestApiSidebar
    {
        /// <summary>
        /// A test endpoint returning a small navigation tree with a header, a
        /// badged link, a collapsible group and a divider.
        /// </summary>
        private sealed class SampleSidebar : RestApiSidebar
        {
            protected override IEnumerable<RestApiSidebarItem> RetrieveItems(IRequest request)
            {
                return
                [
                    new RestApiSidebarItemHeader("Navigation"),
                    new RestApiSidebarItem { Label = "Inbox", Icon = "fas fa-inbox", Badge = "12", BadgeColor = new PropertyColorBackgroundBadge(TypeColorBackgroundBadge.Primary) },
                    new RestApiSidebarItem
                    {
                        Label = "Projects",
                        Expanded = true,
                        Items =
                        [
                            new RestApiSidebarItem { Label = "Alpha", Badge = "3", BadgeColor = new PropertyColorBackgroundBadge("#7c3aed") }
                        ]
                    },
                    new RestApiSidebarItemDivider()
                ];
            }
        }

        /// <summary>
        /// Verifies that the endpoint projects the navigation tree into the
        /// { items: [...] } envelope with camel case keys, nested children and
        /// null members omitted.
        /// </summary>
        [Fact]
        public void Retrieve()
        {
            // arrange
            _ = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var api = new SampleSidebar();
            var request = UnitTestControlFixture.CreateRequestMock();

            // act
            var result = api.Retrieve(request);

            // validation
            Assert.NotNull(result);
            Assert.Equal(200, result.Status);

            var json = Encoding.UTF8.GetString((byte[])result.Content);
            using var doc = JsonDocument.Parse(json);
            var items = doc.RootElement.GetProperty("items").EnumerateArray().ToList();

            Assert.Equal(4, items.Count);

            // header carries its type and label
            Assert.Equal("header", items[0].GetProperty("type").GetString());
            Assert.Equal("Navigation", items[0].GetProperty("label").GetString());

            // link projects camel case keys and omits its null members
            var inbox = items[1];
            Assert.Equal("Inbox", inbox.GetProperty("label").GetString());
            Assert.Equal("12", inbox.GetProperty("badge").GetString());
            Assert.Equal("text-bg-primary", inbox.GetProperty("badgeColor").GetString());
            Assert.False(inbox.TryGetProperty("image", out _));
            Assert.False(inbox.TryGetProperty("type", out _));

            // group nests its children recursively
            var projects = items[2];
            Assert.True(projects.GetProperty("expanded").GetBoolean());
            var children = projects.GetProperty("items").EnumerateArray().ToList();
            Assert.Single(children);
            Assert.Equal("Alpha", children[0].GetProperty("label").GetString());
            Assert.Equal("3", children[0].GetProperty("badge").GetString());

            // a user-defined badge color collapses into the inline style and
            // leaves the css class out of the payload
            Assert.Equal("background:#7c3aed;", children[0].GetProperty("badgeStyle").GetString());
            Assert.False(children[0].TryGetProperty("badgeColor", out _));

            // divider carries its type
            Assert.Equal("divider", items[3].GetProperty("type").GetString());
        }
    }
}
