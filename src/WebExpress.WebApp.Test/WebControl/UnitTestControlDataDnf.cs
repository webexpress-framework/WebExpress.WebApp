using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the read only REST disjunctive normal form control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataDnf
    {
        /// <summary>
        /// Tests the id property of the REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dnf""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-dnf""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDnf(id)
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
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDnf();

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("wx-webapp-dnf", html);
            Assert.DoesNotContain("wx-webui-dnf", html);
        }

        /// <summary>
        /// Tests the value property of the REST dnf control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dnf""></div>")]
        [InlineData("a;b|c", @"<div class=""wx-webapp-dnf"" data-value=""a;b|c""></div>")]
        public void Value(string value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDnf()
            {
                Value = _ => value is null ? null : new ControlFormInputValueDnf(value)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the declared service reaches the client as a service island,
        /// which is what turns the stored term ids into labels.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-dnf""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-dnf""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataDnf()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
