using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the form editor control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestFormEditor
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
            var control = new ControlRestFormEditor(id);

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the form id property of the form editor control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-restform-editor""></div>")]
        [InlineData("00000000-0000-0000-0000-000000000001",
            @"<div class=""wx-webapp-restform-editor"" data-form-id=""00000000-0000-0000-0000-000000000001""></div>")]
        public void FormId(string formId, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                FormId = formId
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the rest uri property is rendered as a data attribute.
        /// </summary>
        [Fact]
        public void RestUri()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                RestUri = new UriEndpoint("/api/1/FormStructure")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-rest-url=""/api/1/FormStructure""></div>",
                html);
        }

        /// <summary>
        /// Tests that the field-catalog uri is rendered as a data attribute.
        /// </summary>
        [Fact]
        public void FieldCatalogUri()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                FieldCatalogUri = new UriEndpoint("/api/1/FormFieldCatalog")
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-field-catalog-url=""/api/1/FormFieldCatalog""></div>",
                html);
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
            var control = new ControlRestFormEditor()
            {
                Preview = preview
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
            var control = new ControlRestFormEditor()
            {
                Indent = indent
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
            var control = new ControlRestFormEditor()
            {
                Readonly = readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the default values match the constants exposed on the control.
        /// </summary>
        [Fact]
        public void Defaults()
        {
            // arrange
            var control = new ControlRestFormEditor();

            // validation
            Assert.Equal(ControlRestFormEditor._defaultIndent, control.Indent);
            Assert.True(control.Preview);
            Assert.False(control.Readonly);
            Assert.Null(control.FormId);
            Assert.Null(control.RestUri);
            Assert.Null(control.FieldCatalogUri);
        }
    }
}
