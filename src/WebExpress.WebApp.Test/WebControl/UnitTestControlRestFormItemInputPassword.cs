using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST password input control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestFormItemInputPassword
    {
        /// <summary>
        /// Tests the id property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-input-password"" name=""id""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the auto id property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(@"<div id=""*"" class=""wx-webapp-input-password"" name=""*""></div>")]
        public void AutoId(string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword()
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-password"" name=""abc""></div>")]
        public void Name(string name, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
            {
                Name = name
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the placeholder property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-password"" data-placeholder=""abc""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div class=""wx-webapp-input-password"" data-placeholder=""WebExpress.WebUI""></div>")]
        public void Placeholder(string placeholder, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
            {
                Placeholder = placeholder
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the min length property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData(0u, @"<div class=""wx-webapp-input-password"" data-minlength=""0""></div>")]
        [InlineData(10u, @"<div class=""wx-webapp-input-password"" data-minlength=""10""></div>")]
        public void MinLength(uint? minLength, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
            {
                MinLength = minLength
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max length property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData(0u, @"<div class=""wx-webapp-input-password"" data-maxlength=""0""></div>")]
        [InlineData(10u, @"<div class=""wx-webapp-input-password"" data-maxlength=""10""></div>")]
        public void MaxLength(uint? maxLength, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
            {
                MaxLength = maxLength
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the required property of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-input-password""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-input-password""></div>")]
        public void Required(bool required, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
            {
                Required = required
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the value method of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div class=""wx-webapp-input-password""></div>*")]
        [InlineData("abc", @"*<div class=""wx-webapp-input-password"" data-value=""abc"">*")]
        public void ValueForm(string value, string expected)
        {
            // arrange
            var initialized = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null);
            var form = new ControlForm().Add(control)
                .Initialize(renderContext =>
                {
                    renderContext.SetValue(control, new ControlFormInputValueString(value));
                    initialized = true;
                });

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(initialized);
        }

        /// <summary>
        /// Tests the value method of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div class=""wx-webapp-input-password""></div>*")]
        [InlineData("abc", @"*<div class=""wx-webapp-input-password"" data-value=""abc"">*")]
        public void ValueItem(string value, string expected)
        {
            // arrange
            var initialized = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword(null)
                .Initialize(arg =>
                {
                    arg.Value.Text = value;
                    initialized = true;
                });
            var form = new ControlForm().Add(control);

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(initialized);
        }

        /// <summary>
        /// Tests the validate method of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""password-box"" class=""wx-webapp-input-password"" name=""password-box""></div>*")]
        [InlineData("abc", @"*<div id=""password-box"" class=""wx-webapp-input-password"" name=""password-box"" data-value=""abc""></div>*")]
        public void ValidateForm(string value, string expected)
        {
            // arrange
            var validated = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword("password-box").Initialize(args =>
            {
                args.Value.Text = value;
            });
            var form = new ControlForm()
                .Add(control)
                .Validate
                (
                    x =>
                    {
                        x
                        .Add(true, "validation1", TypeInputValidity.Warning)
                        .Add(true, "validation2")
                        .Add(false, "validation3");
                        validated = true;
                    }
                );

            context.Request.AddParameter(new Parameter(form.Id, context.Request?.Session.Id.ToString(), ParameterScope.Parameter));
            context.Request.AddParameter(new Parameter("password-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(validated);
        }

        /// <summary>
        /// Tests the process method of the REST password control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""password-box"" class=""wx-webapp-input-password"" name=""password-box""></div>*")]
        [InlineData("abc", @"*<div id=""password-box"" class=""wx-webapp-input-password"" name=""password-box"" data-value=""abc""></div>*")]
        public void ProcessForm(string value, string expected)
        {
            // arrange
            var processed = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputPassword("password-box")
                .Initialize(args =>
                {
                    args.Value.Text = value;
                });
            var form = new ControlForm()
                .Add(control)
                .Process
                (
                    x =>
                    {
                        processed = true;
                    }
                );

            context.Request.AddParameter(new Parameter(form.Id, context.Request?.Session.Id.ToString(), ParameterScope.Parameter));
            context.Request.AddParameter(new Parameter("password-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(processed);
        }
    }
}
