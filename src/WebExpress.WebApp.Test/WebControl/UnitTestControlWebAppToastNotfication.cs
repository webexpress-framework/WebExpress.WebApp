using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebHtml;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the web app toast notification control.
    /// </summary>
    public class UnitTestControlWebAppToastnotification
    {
        /// <summary>
        /// Tests the id property of the web app footer control.
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
            var control = new ControlWebAppToastnotification(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that a toast fragment whose condition refuses leaves no bar behind, and that the
        /// same fragment produces the bar once its condition holds.
        /// </summary>
        /// <param name="conditionFulfilled">Whether the request carries the parameter the fragment's condition asks for.</param>
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void FragmentRenderingNothing(bool conditionFulfilled)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = conditionFulfilled
                ? UnitTestControlFixture.CreateRenderContextMock(application, null, new Parameter(TestConditionToast.ParameterName, "on", ParameterScope.Url))
                : UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppToastnotification("toast");

            // act
            var html = control.Render(context, visualTree)?.ToString();

            // validation
            if (conditionFulfilled)
            {
                Assert.NotNull(html);
                Assert.Contains("wx-toast", html);
                Assert.Contains(TestFragmentToastConditional.Text, html);
            }
            else
            {
                Assert.Null(html);
            }
        }

        /// <summary>
        /// Tests that a child added in code that renders nothing, or markup without output, leaves
        /// no bar behind.
        /// </summary>
        /// <param name="emptyText">Whether the child renders an empty text instead of null.</param>
        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void ChildRenderingNothing(bool emptyText)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlWebAppToastnotification("toast");
            control.AddPrimary(new ControlNothing() { EmptyText = emptyText });

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }

        /// <summary>
        /// A child that renders nothing.
        /// </summary>
        private sealed class ControlNothing : Control
        {
            /// <summary>
            /// Gets or sets whether the control renders an empty text instead of null.
            /// </summary>
            public bool EmptyText { get; set; }

            /// <summary>
            /// Renders nothing.
            /// </summary>
            /// <param name="renderContext">The context in which the control is rendered.</param>
            /// <param name="visualTree">The visual tree representing the control's structure.</param>
            /// <returns>Null, or an empty text.</returns>
            public override IHtmlNode Render(IRenderControlContext renderContext, IVisualTreeControl visualTree)
            {
                return EmptyText ? new HtmlText(string.Empty) : null;
            }
        }
    }
}
