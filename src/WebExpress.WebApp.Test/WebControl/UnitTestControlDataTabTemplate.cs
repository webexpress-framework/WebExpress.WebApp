using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebIcon;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api tab template control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTabTemplate
    {
        /// <summary>
        /// Tests the id property of the api tab control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<template></template>")]
        [InlineData("id", @"<template id=""id""></template>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTabTemplate(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that template metadata attributes are rendered.
        /// </summary>
        [Fact]
        public void Metadata()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTabTemplate("template")
            {
                Icon = _ => new IconUser(),
                Name = _ => "User Template",
                Description = _ => "Template description"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<template id=""template"" data-icon=""fas fa-user"" data-name=""User Template"" data-description=""Template description""></template>", html);
        }

        /// <summary>
        /// Tests that the multiplicity property emits a data-multiplicity attribute when set.
        /// </summary>
        [Theory]
        [InlineData(1, @"<template id=""template"" data-multiplicity=""1""></template>")]
        [InlineData(5, @"<template id=""template"" data-multiplicity=""5""></template>")]
        public void Multiplicity(int multiplicity, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTabTemplate("template")
            {
                Multiplicity = _ => multiplicity
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that omitting the multiplicity property does not emit a data-multiplicity attribute.
        /// </summary>
        [Fact]
        public void MultiplicityUnlimited()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTabTemplate("template")
            {
                Multiplicity = _ => null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<template id=""template""></template>", html);
        }

        /// <summary>
        /// Tests that template id can be read through the interface contract.
        /// </summary>
        [Fact]
        public void InterfaceId()
        {
            // arrange
            IControlDataTabTemplate template = new ControlDataTabTemplate("template-id");

            // validation
            Assert.Equal("template-id", template.Id);
        }

        /// <summary>
        /// Tests that template bind metadata attributes are rendered.
        /// </summary>
        [Fact]
        public void Bind()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTabTemplate("template")
            {
                Bind = _ => new Binding().Add(new BindTemplate()
                    .Add("uri", TypeBindMode.Attr, ".wx-webapp-dashboard", "data-uri")
                    .Add("title"))
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            var htmlString = html.ToString();
            Assert.Contains("data-wx-bind=\"uri, title\"", htmlString);
            Assert.Contains("data-wx-bind-uri-mode=\"attr\"", htmlString);
            Assert.Contains("data-wx-bind-uri-target=\".wx-webapp-dashboard\"", htmlString);
            Assert.Contains("data-wx-bind-uri-name=\"data-uri\"", htmlString);
        }
    }
}
