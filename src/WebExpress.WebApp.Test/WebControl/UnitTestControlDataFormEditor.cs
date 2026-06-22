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
        }
    }
}
