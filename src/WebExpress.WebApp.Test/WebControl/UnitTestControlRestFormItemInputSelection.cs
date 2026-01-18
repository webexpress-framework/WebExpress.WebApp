using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST selection control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestFormItemInputSelection
    {
        /// <summary>
        /// Tests the id property of the form REST selection control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-input-selection"" name=""id""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the auto id property of the form REST selection control.
        /// </summary>
        [Theory]
        [InlineData(@"<div id=""*"" class=""wx-webapp-input-selection"" name=""*""></div>")]
        public void AutoId(string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection()
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the form REST selection control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-selection"" name=""abc""></div>")]
        public void Name(string name, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(null)
            {
                Name = name
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the placeholder property of the form REST selection control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData("Select an option", @"<div class=""wx-webapp-input-selection"" placeholder=""Select an option""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div class=""wx-webapp-input-selection"" placeholder=""WebExpress.WebUI""></div>")]
        public void Placeholder(string placeholder, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(null)
            {
                Placeholder = placeholder
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the MultiSelect property of the form REST selection control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-input-selection"" data-multiselection=""true""></div>")]
        public void MultiSelect(bool multiSelect, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(null)
            {
                MultiSelect = multiSelect
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the api property of the REST selection control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-input-selection"" data-uri=""https://example.com/api/data""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(null)
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max items property of the REST selection control.
        /// </summary>
        [Theory]
        [InlineData(-1, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData(0, @"<div class=""wx-webapp-input-selection""></div>")]
        [InlineData(5, @"<div class=""wx-webapp-input-selection"" data-maxItems=""5""></div>")]
        public void MaxItems(int maxItems, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputSelection(null)
            {
                MaxItems = maxItems
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}