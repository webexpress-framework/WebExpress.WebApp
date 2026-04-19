using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST-backed check control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestFormItemInputCheck
    {
        /// <summary>
        /// Tests the id property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-input-check form-check""><input name=""id"" type=""checkbox"" class=""form-check-input""><label class=""form-check-label"" for=""id""></label></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the auto id property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(@"<div id=""*"" class=""wx-webapp-input-check form-check""><input name=""*"" type=""checkbox"" class=""form-check-input""><label class=""form-check-label"" for=""*""></label></div>")]
        public void AutoId(string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck()
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-check form-check""><input name=""abc"" type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        public void Name(string name, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(null)
            {
                Name = name
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the description property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData("", @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData("description", @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label"">description</label></div>")]
        [InlineData("webexpress.WebUI:plugin.name", @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label"">WebExpress.WebUI</label></div>")]
        public void Description(string description, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(null)
            {
                Description = description
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the layout property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutCheck.Default, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData(TypeLayoutCheck.Switch, @"<div class=""wx-webapp-input-check form-check form-switch""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        public void Layout(TypeLayoutCheck layout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(null)
            {
                Layout = layout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the inline property of the REST check control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData(true, @"<div class=""wx-webapp-input-check form-check form-check-inline""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        public void Inline(bool inline, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(null)
            {
                Inline = inline
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the RestUri property of the REST check control. Verifies that
        /// the configured endpoint is exposed via the <c>data-uri</c> attribute
        /// on the root element so the client-side module can target it for
        /// GET (initial read) and POST (state changes).
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-check form-check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        [InlineData("https://example.com/api/check", @"<div class=""wx-webapp-input-check form-check"" data-uri=""https://example.com/api/check""><input type=""checkbox"" class=""form-check-input""><label class=""form-check-label""></label></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck(null)
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the control omits the <c>data-value</c> attribute when no
        /// initial value is supplied, so the client-side module falls back to a
        /// GET request against the configured REST endpoint.
        /// </summary>
        [Fact]
        public void NoInitialValueOmitsDataValue()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck("chk")
            {
                RestUri = new UriEndpoint("https://example.com/api/check")
            };
            var form = new ControlForm().Add(control);

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                @"*<div id=""chk"" class=""wx-webapp-input-check form-check"" data-uri=""https://example.com/api/check""><input name=""chk"" type=""checkbox"" class=""form-check-input""><label class=""form-check-label"" for=""chk""></label></div>*",
                html);
        }

        /// <summary>
        /// Tests that <see cref="ControlRestFormItemInputCheck.InitialChecked"/>
        /// causes the control to emit the <c>data-value</c> attribute so the
        /// client can skip the initial GET request and use the supplied value
        /// directly.
        /// </summary>
        [Theory]
        [InlineData(true, "true", @"<input name=""chk"" type=""checkbox"" class=""form-check-input"" checked>")]
        [InlineData(false, "false", @"<input name=""chk"" type=""checkbox"" class=""form-check-input"">")]
        public void InitialCheckedEmitsDataValue(bool initial, string expectedValue, string expectedInput)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputCheck("chk")
            {
                RestUri = new UriEndpoint("https://example.com/api/check"),
                InitialChecked = initial
            };
            var form = new ControlForm().Add(control);

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(
                $@"*<div id=""chk"" class=""wx-webapp-input-check form-check"" data-uri=""https://example.com/api/check"" data-value=""{expectedValue}"">{expectedInput}<label class=""form-check-label"" for=""chk""></label></div>*",
                html);
        }
    }
}
