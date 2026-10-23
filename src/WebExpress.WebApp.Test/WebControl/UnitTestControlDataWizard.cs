using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the api wizard control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataWizard
    {
        /// <summary>
        /// Tests the id property of the api wizard control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""></form>")]
        [InlineData("id", @"<form id=""id"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""></form>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the service factory of the api wizard control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""></form>")]
        [InlineData("https://example.com/api/data", @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data""></wx-service></form>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.FormData(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the render overload renders the pages it is handed rather than
        /// the pages the control collected.
        /// </summary>
        [Fact]
        public void RenderPages()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard("wizard");
            control.Add(new ControlDataWizardPage("collected"));

            // act
            var html = control.Render(context, visualTree, [new ControlDataWizardPage("handed")]);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<form id=""wizard"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""><div id=""handed"" class=""wx-wizard-page"">*</div></form>",
                html
            );
        }

        /// <summary>
        /// Tests the http method the api wizard control derives from its mode.
        /// </summary>
        [Theory]
        [InlineData(TypeRestFormMode.Default, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST""></form>")]
        [InlineData(TypeRestFormMode.Add, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST"" data-mode=""new""></form>")]
        [InlineData(TypeRestFormMode.Clone, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST"" data-mode=""new""></form>")]
        [InlineData(TypeRestFormMode.Edit, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""PUT"" data-method=""PUT"" data-mode=""edit""></form>")]
        [InlineData(TypeRestFormMode.Delete, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""DELETE"" data-method=""DELETE"" data-mode=""delete""></form>")]
        public void Method(TypeRestFormMode mode, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard()
            {
                Mode = _ => mode
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that an item id turns the undeclared mode into an update, the way the
        /// client infers its mode.
        /// </summary>
        [Fact]
        public void MethodWithItemId()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard()
            {
                ItemId = _ => "42"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders
            (
                @"<form id=""*"" class=""wx-webapp-restwizard"" method=""PUT"" data-method=""PUT"" data-id=""42""></form>",
                html
            );
        }

        /// <summary>
        /// Tests the explicitly declared http method of the api wizard control.
        /// </summary>
        [Theory]
        [InlineData(RequestMethod.PATCH, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""PATCH"" data-method=""PATCH"" data-mode=""new""></form>")]
        [InlineData(RequestMethod.POST, @"<form id=""*"" class=""wx-webapp-restwizard"" method=""POST"" data-method=""POST"" data-mode=""new""></form>")]
        [InlineData(RequestMethod.NONE, @"<form id=""*"" class=""wx-webapp-restwizard"" data-mode=""new""></form>")]
        public void MethodExplicit(RequestMethod method, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var application = componentHub.ApplicationManager.GetApplications(typeof(TestApplication)).FirstOrDefault();
            var context = UnitTestControlFixture.CreateRenderContextMock(application);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataWizard()
            {
                Mode = _ => TypeRestFormMode.Add,
                Method = _ => method
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}