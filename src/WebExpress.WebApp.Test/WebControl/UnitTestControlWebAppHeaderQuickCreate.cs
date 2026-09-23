using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app header quick create control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlWebAppHeaderQuickCreate
    {
        /// <summary>
        /// Tests the id property of the web app header quick create control.
        /// </summary>
        [Theory]
        [InlineData(null, null)]
        [InlineData("id", null)]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderQuickCreate(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// A quick-create fragment whose condition the request does not fulfill produces no
        /// button, although the header only reads the fragment's link instead of rendering it.
        /// With the condition fulfilled the same fragment does produce the button, which shows
        /// the fragment is registered for the header at all.
        /// </summary>
        /// <param name="conditionFulfilled">Whether the request carries the parameter the fragment's condition requires.</param>
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void FragmentConditionDecidesButton(bool conditionFulfilled)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = conditionFulfilled
                ? UnitTestControlFixture.CreateRenderContextMock(application, null, new Parameter(TestConditionQuickCreate.ParameterName, "on", ParameterScope.Url))
                : UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppHeaderQuickCreate("quickcreate");

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            if (conditionFulfilled)
            {
                Assert.NotNull(html);
                Assert.Contains(TestFragmentQuickCreateConditional.TargetUri, html);
            }
            else
            {
                Assert.Null(html);
            }
        }
    }
}
