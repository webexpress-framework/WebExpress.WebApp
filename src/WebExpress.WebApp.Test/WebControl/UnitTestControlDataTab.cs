using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api tab control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTab
    {
        /// <summary>
        /// Tests the id property of the api tab control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div id=""*"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }


        /// <summary>
        /// Tests the readonly property emits a data-readonly attribute only when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-tab"" data-readonly=""true""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the MovableTab flag emits a data-movable-tab attribute only when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div id=""*"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData(true, @"<div id=""*"" class=""wx-webapp-tab"" data-movable-tab=""true""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        public void MovableTab(bool movable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                MovableTab = _ => movable
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the layout reaches the client as a data-layout attribute, which the
        /// tab controller needs because it builds the headers itself.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutTab.Default, @"<div id=""*"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData(TypeLayoutTab.Pill, @"<div id=""*"" class=""wx-webapp-tab"" data-layout=""pill""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData(TypeLayoutTab.Underline, @"<div id=""*"" class=""wx-webapp-tab"" data-layout=""underline""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        public void Layout(TypeLayoutTab layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                Layout = _ => layout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that a highlight color overrides the underline variables, and only does
        /// so in the layout that draws an underline at all.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutTab.Underline, @"<div id=""*"" class=""wx-webapp-tab"" style=""--bs-nav-underline-border-color: #ff0000; --bs-nav-underline-link-active-color: #ff0000;"" data-layout=""underline""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        [InlineData(TypeLayoutTab.Pill, @"<div id=""*"" class=""wx-webapp-tab"" data-layout=""pill""><div class=""wx-webapp-tab-empty d-none"">*</div></div>")]
        public void HighlightColorUser(TypeLayoutTab layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                Layout = _ => layout,
                HighlightColor = _ => new PropertyColorText("#ff0000")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that a system highlight color resolves to its css variable, because the
        /// underline variables take a color rather than the class the color would emit.
        /// </summary>
        [Fact]
        public void HighlightColorSystem()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab()
            {
                Layout = _ => TypeLayoutTab.Underline,
                HighlightColor = _ => new PropertyColorText(TypeColorText.Danger)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<div id=""*"" class=""wx-webapp-tab"" style=""--bs-nav-underline-border-color: var(--bs-danger); --bs-nav-underline-link-active-color: var(--bs-danger);"" data-layout=""underline""><div class=""wx-webapp-tab-empty d-none"">*</div></div>",
                html
            );
        }

        /// <summary>
        /// Tests that an authored empty state replaces the generic placeholder.
        /// </summary>
        [Fact]
        public void EmptyState()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTab("id")
            {
                EmptyState = new ControlEmptyState()
                {
                    Title = _ => "No views",
                    Message = _ => "Create a view to get started."
                }
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<div id=""id"" class=""wx-webapp-tab""><div class=""wx-webapp-tab-empty d-none""><div class=""wx-empty-state""><span class=""wx-empty-state-title"">No views</span><span class=""wx-empty-state-message"">Create a view to get started.</span></div></div></div>",
                html
            );
        }
    }
}
