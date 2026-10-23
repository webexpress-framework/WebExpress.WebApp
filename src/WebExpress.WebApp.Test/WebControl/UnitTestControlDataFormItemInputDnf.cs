using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST disjunctive normal form control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataFormItemInputDnf
    {
        /// <summary>
        /// Tests the id property of the form REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-input-dnf"" name=""id""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the auto id property of the form REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(@"<div id=""*"" class=""wx-webapp-input-dnf"" name=""*""></div>")]
        public void AutoId(string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf()
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the static marker class is replaced rather than joined, so the
        /// client builds exactly one control on the element.
        /// </summary>
        [Fact]
        public void ReplacesTheStaticMarker()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(null);

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("wx-webapp-input-dnf", html);
            Assert.DoesNotContain("wx-webui-input-dnf", html);
        }

        /// <summary>
        /// Tests the placeholder property of the form REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-dnf"" placeholder=""abc""></div>")]
        public void Placeholder(string placeholder, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(null)
            {
                Placeholder = _ => placeholder
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max groups property of the form REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData(3, @"<div class=""wx-webapp-input-dnf"" data-max-groups=""3""></div>")]
        public void MaxGroups(int maxGroups, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(null)
            {
                MaxGroups = _ => maxGroups
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the declared service reaches the client as a service island,
        /// which is the single configuration channel the endpoint travels through.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-input-dnf""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(null)
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max items property of the REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData(0, @"<div class=""wx-webapp-input-dnf""></div>")]
        [InlineData(5, @"<div class=""wx-webapp-input-dnf"" data-maxItems=""5""></div>")]
        public void MaxItems(int maxItems, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputDnf(null)
            {
                MaxItems = _ => maxItems
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
