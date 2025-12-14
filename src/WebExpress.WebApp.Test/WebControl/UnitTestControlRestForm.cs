using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebCore.WebMessage;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the rest form control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestForm
    {
        /// <summary>
        /// Tests the id property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData("id", @"<form id=""id"" class=""wx-webapp-restform"">*</form>")]
        public void Id(string id, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm(id)
            {
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the backgroundcolor property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeColorBackground.Default, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(TypeColorBackground.Primary, @"<form id=""*"" class=""wx-webapp-restform bg-primary"">*</form>")]
        [InlineData(TypeColorBackground.Secondary, @"<form id=""*"" class=""wx-webapp-restform bg-secondary"">*</form>")]
        [InlineData(TypeColorBackground.Warning, @"<form id=""*"" class=""wx-webapp-restform bg-warning"">*</form>")]
        [InlineData(TypeColorBackground.Danger, @"<form id=""*"" class=""wx-webapp-restform bg-danger"">*</form>")]
        [InlineData(TypeColorBackground.Dark, @"<form id=""*"" class=""wx-webapp-restform bg-dark"">*</form>")]
        [InlineData(TypeColorBackground.Light, @"<form id=""*"" class=""wx-webapp-restform bg-light"">*</form>")]
        [InlineData(TypeColorBackground.Transparent, @"<form id=""*"" class=""wx-webapp-restform bg-transparent"">*</form>")]
        public void BackgroundColor(TypeColorBackground color, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                BackgroundColor = new PropertyColorBackground(color)
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData("abc", @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        public void Name(string name, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                Name = name
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the uri property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData("", @"<form id=""*"" class=""wx-webapp-restform"" data-uri=""/"">*</form>")]
        [InlineData("http://localhost:8080/webui", @"<form id=""*"" class=""wx-webapp-restform"" data-uri=""http://localhost:8080/webui"">*</form>")]
        public void Uri(string uri, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                Uri = uri is not null ? new UriEndpoint(uri) : null
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the method property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(RequestMethod.NONE, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.POST, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.PUT, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.GET, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.PATCH, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.DELETE, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        public void Method(RequestMethod method, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm(null)
            {
                Method = method
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the form layout property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutForm.Default, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(TypeLayoutForm.Inline, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        public void FormLayout(TypeLayoutForm formLayout, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                FormLayout = formLayout
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the item layout property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutFormItem.Horizontal, @"<form id=""*"" class=""wx-webapp-restform""><main><div class=""wx-form-group-horizontal"">*</div></main><div></div></form>")]
        [InlineData(TypeLayoutFormItem.Vertical, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(TypeLayoutFormItem.Mix, @"<form id=""*"" class=""wx-webapp-restform""><main><div class=""wx-form-group-mix"">*</div></main><div></div></form>")]
        public void ItemLayout(TypeLayoutFormItem itemLayout, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                ItemLayout = itemLayout
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the justify property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeJustifiedFlex.None, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(TypeJustifiedFlex.Start, @"<form id=""*"" class=""wx-webapp-restform justify-content-start"">*</form>")]
        [InlineData(TypeJustifiedFlex.Around, @"<form id=""*"" class=""wx-webapp-restform justify-content-around"">*</form>")]
        [InlineData(TypeJustifiedFlex.Between, @"<form id=""*"" class=""wx-webapp-restform justify-content-between"">*</form>")]
        [InlineData(TypeJustifiedFlex.End, @"<form id=""*"" class=""wx-webapp-restform justify-content-end"">*</form>")]
        public void Justify(TypeJustifiedFlex justify, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm()
            {
                Justify = justify,
            };

            // test execution
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests a empty rest form.
        /// </summary>
        [Fact]
        public void EmptyForm()
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm();

            // test execution
            var html = control.Render(context, visualTree)?.ToString().Trim();

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<form id=""*"" class=""wx-webapp-restform"">*</form>", html);
        }

        /// <summary>
        /// Tests a empty rest form.
        /// </summary>
        [Fact]
        public void EmptyFormChangeSubmitText()
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestForm();
            control.AddPrimaryButton(new ControlFormItemButtonSubmit("")
            {
                Text = "sendbutton"
            });

            // test execution
            var html = control.Render(context, visualTree)?.ToString().Trim();

            // validation
            Assert.Contains(@"sendbutton", html);
        }

        /// <summary>
        /// Tests the value property of the form text control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData("abc", @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        public void Value(string value, string expected)
        {
            // preconditions
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlFormItemInputText(null);
            var form = new ControlRestForm().Add(control).Initialize(renderContext =>
            {
                renderContext.SetValue(control, new ControlFormInputValueString(value));
            });

            // test execution
            var html = form.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
