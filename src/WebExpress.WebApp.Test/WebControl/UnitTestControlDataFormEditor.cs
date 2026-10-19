using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the form editor control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataFormEditor
    {
        /// <summary>
        /// Tests the id property of the form editor control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-restform-editor""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-restform-editor""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the declared data service is rendered as the wx-service
        /// island element.
        /// </summary>
        [Fact]
        public void DataService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("/api/1/FormStructure")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor""><wx-service hidden name=""data"" kind=""rest"" base-uri=""/api/1/FormStructure""></wx-service></div>",
                html);
        }

        /// <summary>
        /// Tests that a declared draft service is rendered as a second wx-service
        /// island beside the data one, so the client finds the two meanings of
        /// save side by side.
        /// </summary>
        [Fact]
        public void DraftService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("/api/1/FormStructure"),
                DraftServiceFactory = _ => DataServiceDescriptor.DraftData("/api/1/FormDraft")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor""><wx-service hidden name=""data"" kind=""rest"" base-uri=""/api/1/FormStructure""></wx-service><wx-service hidden name=""draft"" kind=""rest"" base-uri=""/api/1/FormDraft"" method=""GET"" update-method=""PUT""></wx-service></div>",
                html);
        }

        /// <summary>
        /// Tests that a request not allowed to hold a draft withdraws the draft
        /// island without withdrawing the declared endpoint.
        /// </summary>
        [Fact]
        public void DraftServiceOff()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("/api/1/FormStructure"),
                DraftServiceFactory = _ => DataServiceDescriptor.DraftData("/api/1/FormDraft"),
                Draft = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor""><wx-service hidden name=""data"" kind=""rest"" base-uri=""/api/1/FormStructure""></wx-service></div>",
                html);
            Assert.NotNull(control.DraftServiceFactory);
        }

        /// <summary>
        /// Tests the preview property toggles the data-preview attribute.
        /// </summary>
        [Theory]
        [InlineData(true, "<div class=\"wx-webapp-restform-editor\"></div>")]
        [InlineData(false, "<div class=\"wx-webapp-restform-editor\" data-preview=\"false\"></div>")]
        public void Preview(bool preview, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                Preview = _ => preview
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the indent property is clamped between 8 and 32.
        /// </summary>
        [Theory]
        [InlineData(8, "<div class=\"wx-webapp-restform-editor\" data-indent=\"8\"></div>")]
        [InlineData(18, "<div class=\"wx-webapp-restform-editor\"></div>")]
        [InlineData(32, "<div class=\"wx-webapp-restform-editor\" data-indent=\"32\"></div>")]
        [InlineData(0, "<div class=\"wx-webapp-restform-editor\" data-indent=\"8\"></div>")]
        [InlineData(99, "<div class=\"wx-webapp-restform-editor\" data-indent=\"32\"></div>")]
        public void Indent(int indent, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                Indent = _ => indent
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
        [InlineData(false, @"<div class=""wx-webapp-restform-editor""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-restform-editor"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the fill mode marks the host, which is what makes the shell
        /// hand a height down to the editor instead of letting it grow.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-restform-editor""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-restform-editor wx-fill""></div>")]
        public void Fill(bool fill, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                Fill = _ => fill
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the initial state reaches the client as the wx-state island,
        /// which the editor reads before it replaces the children of the host.
        /// </summary>
        [Fact]
        public void StateFactory()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                ServiceFactory = _ => DataServiceDescriptor.FormData("/api/1/FormStructure"),
                StateFactory = _ => DataState.Create().Set("create", true)
            };

            // act
            var html = control.Render(context, visualTree).ToString();

            // validation
            Assert.Contains("<wx-state", html);
            Assert.Contains(@"name=""create""", html);
            Assert.Contains(@"name=""data""", html);
        }

        /// <summary>
        /// Tests that a template reference is not emitted: a template would replace
        /// the whole designer on the client, which the editor does not support.
        /// </summary>
        [Fact]
        public void TemplateIsNotEmitted()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                TemplateFactory = _ => "my-template"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-restform-editor""></div>", html);
        }

        /// <summary>
        /// Tests that a ViewState-bound editor emits the resource binding instead of
        /// its own data island, while the draft island stays its own.
        /// </summary>
        [Fact]
        public void ViewStateBound()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormEditor()
            {
                // even with a data service declared, the resource binding wins
                ServiceFactory = _ => DataServiceDescriptor.FormData("/api/1/FormStructure"),
                DraftServiceFactory = _ => DataServiceDescriptor.DraftData("/api/1/FormDraft"),
                ResourceFactory = _ => "form",
                ViewState = _ => "designer"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-wx-resource=""form"" data-wx-viewstate=""designer""><wx-service hidden name=""draft"" kind=""rest"" base-uri=""/api/1/FormDraft"" method=""GET"" update-method=""PUT""></wx-service></div>",
                html);
        }

        /// <summary>
        /// Tests that the typed resource binding sets the resource factory to the
        /// resource type name and keeps the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void ResourceBindsByType()
        {
            // arrange & act: the assignment compiles only because the typed overload
            // returns the concrete control type
            ControlDataFormEditor control = new ControlDataFormEditor("editor").Resource<FormEditorTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<FormEditorTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// Tests that the default values match the constants exposed on the control.
        /// </summary>
        [Fact]
        public void Defaults()
        {
            // arrange
            var control = new ControlDataFormEditor();

            // validation
            Assert.Equal(ControlDataFormEditor._defaultIndent, control.Indent?.Invoke(null));
            Assert.True(control.Preview?.Invoke(null));
            Assert.False(control.Readonly?.Invoke(null) ?? false);
            Assert.Null(control.ServiceFactory);
            Assert.Null(control.DraftServiceFactory);
            Assert.True(control.Draft?.Invoke(null));
            Assert.Null(control.ResourceFactory);
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class FormEditorTestResource : IDataResource
        {
        }
    }
}
