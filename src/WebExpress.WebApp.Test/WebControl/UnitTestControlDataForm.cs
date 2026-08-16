using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
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
    public class UnitTestControlDataForm
    {
        /// <summary>
        /// Tests the id property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData("id", @"<form id=""id"" class=""wx-webapp-restform"" *>*</form>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the backgroundcolor property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeColorBackground.Default, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData(TypeColorBackground.Primary, @"<form id=""*"" class=""wx-webapp-restform bg-primary"" *>*</form>")]
        [InlineData(TypeColorBackground.Secondary, @"<form id=""*"" class=""wx-webapp-restform bg-secondary"" *>*</form>")]
        [InlineData(TypeColorBackground.Warning, @"<form id=""*"" class=""wx-webapp-restform bg-warning"" *>*</form>")]
        [InlineData(TypeColorBackground.Danger, @"<form id=""*"" class=""wx-webapp-restform bg-danger"" *>*</form>")]
        [InlineData(TypeColorBackground.Dark, @"<form id=""*"" class=""wx-webapp-restform bg-dark"" *>*</form>")]
        [InlineData(TypeColorBackground.Light, @"<form id=""*"" class=""wx-webapp-restform bg-light"" *>*</form>")]
        [InlineData(TypeColorBackground.Transparent, @"<form id=""*"" class=""wx-webapp-restform bg-transparent"" *>*</form>")]
        public void BackgroundColor(TypeColorBackground color, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                BackgroundColor = _ => new PropertyColorBackground(color)
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData("abc", @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        public void Name(string name, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                Name = _ => name
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the declared data service of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData("http://localhost:8080/webui", @"<form id=""*"" class=""wx-webapp-restform"" *><wx-service hidden name=""data"" kind=""rest"" base-uri=""http://localhost:8080/webui""></wx-service>*</form>")]
        public void DataService(string uri, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                ServiceFactory = uri is not null ? _ => DataServiceDescriptor.FormData(uri) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the method property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(RequestMethod.NONE, @"<form id=""*"" class=""wx-webapp-restform"">*</form>")]
        [InlineData(RequestMethod.POST, @"<form id=""*"" class=""wx-webapp-restform"" method=""POST"" data-method=""POST"">*</form>")]
        [InlineData(RequestMethod.PUT, @"<form id=""*"" class=""wx-webapp-restform"" method=""PUT"" data-method=""PUT"">*</form>")]
        [InlineData(RequestMethod.GET, @"<form id=""*"" class=""wx-webapp-restform"" method=""GET"" data-method=""GET"">*</form>")]
        [InlineData(RequestMethod.PATCH, @"<form id=""*"" class=""wx-webapp-restform"" method=""PATCH"" data-method=""PATCH"">*</form>")]
        [InlineData(RequestMethod.DELETE, @"<form id=""*"" class=""wx-webapp-restform"" method=""DELETE"" data-method=""DELETE"">*</form>")]
        public void Method(RequestMethod method, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm(null)
            {
                Method = _ => method
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the mode property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeRestFormMode.Default, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData(TypeRestFormMode.Add, @"<form id=""*"" class=""wx-webapp-restform"" * data-mode=""new"">*</form>")]
        [InlineData(TypeRestFormMode.Edit, @"<form id=""*"" class=""wx-webapp-restform"" * data-mode=""edit"">*</form>")]
        [InlineData(TypeRestFormMode.Delete, @"<form id=""*"" class=""wx-webapp-restform"" * data-mode=""delete"">*</form>")]
        public void Mode(TypeRestFormMode mode, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm(null)
            {
                Mode = _ => mode.ToMode()
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the form layout property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutForm.Default, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData(TypeLayoutForm.Inline, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        public void FormLayout(TypeLayoutForm formLayout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                FormLayout = _ => formLayout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the item layout property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeLayoutFormItem.Horizontal, @"<form id=""*"" class=""wx-webapp-restform"" *><main><div class=""wx-form-group-horizontal"">*</div></main><div></div></form>")]
        [InlineData(TypeLayoutFormItem.Vertical, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData(TypeLayoutFormItem.Mix, @"<form id=""*"" class=""wx-webapp-restform"" *><main><div class=""wx-form-group-mix"">*</div></main><div></div></form>")]
        public void ItemLayout(TypeLayoutFormItem itemLayout, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                ItemLayout = _ => itemLayout
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the justify property of the rest form control.
        /// </summary>
        [Theory]
        [InlineData(TypeJustifiedFlex.None, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData(TypeJustifiedFlex.Start, @"<form id=""*"" class=""wx-webapp-restform justify-content-start"" *>*</form>")]
        [InlineData(TypeJustifiedFlex.Around, @"<form id=""*"" class=""wx-webapp-restform justify-content-around"" *>*</form>")]
        [InlineData(TypeJustifiedFlex.Between, @"<form id=""*"" class=""wx-webapp-restform justify-content-between"" *>*</form>")]
        [InlineData(TypeJustifiedFlex.End, @"<form id=""*"" class=""wx-webapp-restform justify-content-end"" *>*</form>")]
        public void Justify(TypeJustifiedFlex justify, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm()
            {
                Justify = _ => justify,
            };

            // act
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
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm();

            // act
            var html = control.Render(context, visualTree)?.ToString().Trim();

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<form id=""*"" class=""wx-webapp-restform"" *>*</form>", html);
        }

        /// <summary>
        /// Tests a empty rest form.
        /// </summary>
        [Fact]
        public void EmptyFormChangeSubmitText()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataForm();
            control.AddPrimaryButton(new ControlFormItemButtonSubmit("")
            {
                Text = _ => "sendbutton"
            });

            // act
            var html = control.Render(context, visualTree)?.ToString().Trim();

            // validation
            Assert.Contains(@"sendbutton", html);
        }

        /// <summary>
        /// Tests the value property of the form text control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        [InlineData("abc", @"<form id=""*"" class=""wx-webapp-restform"" *>*</form>")]
        public void Value(string value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlFormItemInputText(null);
            var form = new ControlDataForm().Add(control).Initialize(renderContext =>
            {
                renderContext.SetValue(control, new ControlFormInputValueString(value));
            });

            // act
            var html = form.Render(context, visualTree);

            AssertExtensions.EqualWithPlaceholders(expected, html);
        }
    }
}
