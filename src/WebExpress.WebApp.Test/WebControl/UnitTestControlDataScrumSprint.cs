using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the scrum sprint control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataScrumSprint
    {
        /// <summary>
        /// Tests the id property of the scrum sprint control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-scrum-sprint""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-scrum-sprint""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumSprint(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the scrum sprint control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-scrum-sprint""></div>")]
        [InlineData("https://example.com/api/scrum/sprint", @"<div id=""*"" class=""wx-webapp-scrum-sprint""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/scrum/sprint"" method=""GET""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumSprint()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// When bound to a ViewState resource, the control emits only the
        /// <c>data-wx-resource</c> binding and skips its own <c>wx-service</c>
        /// island, because the enclosing ViewState owns the service and the central load.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceBinding_NotService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataScrumSprint()
            {
                // even with a service declared, the resource binding wins
                ServiceFactory = _ => DataServiceDescriptor.QueryData("https://example.com/api/scrum/sprint"),
                ResourceFactory = _ => "sprint"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""*"" class=""wx-webapp-scrum-sprint"" data-wx-resource=""sprint""></div>", html);
        }

        /// <summary>
        /// The fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource factory to the
        /// resource type name and preserves the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act: the assignment compiles only because the typed overload returns the
            // concrete control type rather than IViewStateBound
            ControlDataScrumSprint control = new ControlDataScrumSprint("sprint").Resource<SprintTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<SprintTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class SprintTestResource : IDataResource
        {
        }
    }
}
