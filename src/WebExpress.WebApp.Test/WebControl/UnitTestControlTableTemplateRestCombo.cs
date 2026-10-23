using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST combo table template control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlTableTemplateRestCombo
    {
        /// <summary>
        /// Tests the id property of the rest combo template control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<template data-type=""rest_combo""></template>")]
        [InlineData("id", @"<template id=""id"" data-type=""rest_combo""></template>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlTableTemplateRestCombo(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the editable property. Read-only is the implied default, so only
        /// the editable deviation is emitted.
        /// </summary>
        [Theory]
        [InlineData(false, @"<template data-type=""rest_combo""></template>")]
        [InlineData(true, @"<template data-type=""rest_combo"" data-editable=""true""></template>")]
        public void Editable(bool editable, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlTableTemplateRestCombo()
            {
                Editable = _ => editable
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
