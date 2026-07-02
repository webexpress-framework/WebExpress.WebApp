using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the status (dot) table template control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlTableTemplateStatus
    {
        /// <summary>
        /// Tests the id property of the status template control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<template data-type=""status""></template>")]
        [InlineData("id", @"<template id=""id"" data-type=""status""></template>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlTableTemplateStatus(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the ShowLabel property. Only the true deviation is emitted; the
        /// dot-only default stays implicit.
        /// </summary>
        [Theory]
        [InlineData(false, @"<template data-type=""status""></template>")]
        [InlineData(true, @"<template data-type=""status"" data-show-label=""true""></template>")]
        public void ShowLabel(bool showLabel, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlTableTemplateStatus()
            {
                ShowLabel = _ => showLabel
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
