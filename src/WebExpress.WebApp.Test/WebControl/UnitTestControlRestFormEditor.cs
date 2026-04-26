using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
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
        [InlineData(null, @"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>")]
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
        [InlineData(null, @"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>")]
        [InlineData("00000000-0000-0000-0000-000000000001",
            @"<div class=""wx-webapp-restform-editor"" data-form-id=""00000000-0000-0000-0000-000000000001"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>")]
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
        /// Tests that the rest url property is rendered as a data attribute.
        /// </summary>
        [Fact]
        public void RestUrl()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                RestUrl = "/api/1/FormStructure"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-rest-url=""/api/1/FormStructure"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>",
                html);
        }

        /// <summary>
        /// Tests that the field-catalog url is rendered as a data attribute.
        /// </summary>
        [Fact]
        public void FieldCatalogUrl()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                FieldCatalogUrl = "/api/1/FormFieldCatalog"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-field-catalog-url=""/api/1/FormFieldCatalog"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>",
                html);
        }

        /// <summary>
        /// Tests the layout property — invalid values fall back to the default.
        /// </summary>
        [Theory]
        [InlineData("two-pane", "two-pane")]
        [InlineData("tree-table", "tree-table")]
        [InlineData("three-pane", "three-pane")]
        [InlineData("garbage", "two-pane")]
        [InlineData(null, "two-pane")]
        public void Layout(string layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                Layout = layout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                $@"<div class=""wx-webapp-restform-editor"" data-layout=""{expected}"" data-preview=""true"" data-indent=""18""></div>",
                html);
        }

        /// <summary>
        /// Tests the preview property toggles the data-preview attribute.
        /// </summary>
        [Theory]
        [InlineData(true, "true")]
        [InlineData(false, "false")]
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
            AssertExtensions.EqualWithPlaceholders(
                $@"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""{expected}"" data-indent=""18""></div>",
                html);
        }

        /// <summary>
        /// Tests the indent property is clamped between 8 and 32.
        /// </summary>
        [Theory]
        [InlineData(8, "8")]
        [InlineData(18, "18")]
        [InlineData(32, "32")]
        [InlineData(0, "8")]
        [InlineData(99, "32")]
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
            AssertExtensions.EqualWithPlaceholders(
                $@"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""{expected}""></div>",
                html);
        }

        /// <summary>
        /// Tests the readonly property emits a data-readonly attribute only when true.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18"" data-readonly=""true""></div>")]
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
        /// Tests the initial-structure JSON is propagated as a data-initial-structure attribute.
        /// </summary>
        [Fact]
        public void InitialStructureJson()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormEditor()
            {
                InitialStructureJson = "{\"tabs\":[]}"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"<div class=""wx-webapp-restform-editor"" data-layout=""two-pane"" data-preview=""true"" data-indent=""18"" data-initial-structure=""*""></div>",
                html);
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
            Assert.Equal(ControlRestFormEditor.DefaultLayout, control.Layout);
            Assert.Equal(ControlRestFormEditor.DefaultIndent, control.Indent);
            Assert.True(control.Preview);
            Assert.False(control.Readonly);
            Assert.Null(control.FormId);
            Assert.Null(control.RestUrl);
            Assert.Null(control.FieldCatalogUrl);
            Assert.Null(control.InitialStructureJson);
        }
    }
}
