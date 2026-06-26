using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the scrum team workload control. The control only emits the host
    /// element; the avatar row, the overflow chip and the modal table are built
    /// by the JS controller <c>webexpress.webapp.ScrumTeamCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataScrumTeam
    {
        /// <summary>
        /// Tests the id property of the scrum team control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-team""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-scrum-team""></div>")]
        [InlineData("87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B", @"<div id=""87BD7E47-9D08-4DAB-BFFE-DA2B2DD12C3B"" class=""wx-webapp-scrum-team""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumTeam(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the data service of the scrum team control, which loads the
        /// people of the current sprint with a single GET.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-team""></div>")]
        [InlineData("https://example.com/api/scrum/team", @"<div class=""wx-webapp-scrum-team""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/scrum/team"" method=""GET""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumTeam()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the MaxVisible property renders into the
        /// <c>data-max-visible</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-scrum-team""></div>")]
        [InlineData(8, @"<div class=""wx-webapp-scrum-team"" data-max-visible=""8""></div>")]
        public void MaxVisible(int? maxVisible, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumTeam()
            {
                MaxVisible = _ => maxVisible
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the id, the data service and the MaxVisible attribute rendering
        /// together.
        /// </summary>
        [Fact]
        public void AllAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumTeam("t1")
            {
                ServiceFactory = _ => DataServiceDescriptor.QueryData("https://example.com/api/scrum/team"),
                MaxVisible = _ => 5
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""t1"" class=""wx-webapp-scrum-team"" data-max-visible=""5""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/scrum/team"" method=""GET""></wx-service></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert scrum team host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumTeam()
            {
                Enable = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }
    }
}
