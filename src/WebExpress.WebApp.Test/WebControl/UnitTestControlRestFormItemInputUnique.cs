using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebApiControl;
using WebExpress.WebCore.WebParameter;
using WebExpress.WebCore.WebUri;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST unique control.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlRestFormItemInputUnique
    {
        /// <summary>
        /// Tests the id property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-input-unique"" name=""id""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the auto id property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(@"<div id=""*"" class=""wx-webapp-input-unique"" name=""*""></div>")]
        public void AutoId(string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique()
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the name property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-unique"" name=""abc""></div>")]
        public void Name(string name, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                Name = name
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the description property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-unique""></div>")]
        public void Description(string description, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                Description = description
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the placeholder property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("abc", @"<div class=""wx-webapp-input-unique"" placeholder=""abc""></div>")]
        [InlineData("webexpress.webui:plugin.name", @"<div class=""wx-webapp-input-unique"" placeholder=""WebExpress.WebUI""></div>")]
        public void Placeholder(string placeholder, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                Placeholder = placeholder
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the min length property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData(0u, @"<div class=""wx-webapp-input-unique"" data-minlength=""0""></div>")]
        [InlineData(10u, @"<div class=""wx-webapp-input-unique"" data-minlength=""10""></div>")]
        public void MinLength(uint? minLength, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                MinLength = minLength
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the max length property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData(0u, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData(10u, @"<div class=""wx-webapp-input-unique""></div>")]
        public void MaxLength(uint? maxLength, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                MaxLength = maxLength
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the required property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-input-unique""></div>")]
        public void Required(bool required, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                Required = required
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the pattern property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("abc.*", @"<div class=""wx-webapp-input-unique""></div>")]
        public void Pattern(string pattern, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                Pattern = pattern
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the api property of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-input-unique""></div>")]
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-input-unique"" data-uri=""https://example.com/api/data""></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
            {
                RestUri = uriString is not null ? new UriEndpoint(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the value method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div class=""wx-webapp-input-unique""></div>*")]
        [InlineData("abc", @"*<div class=""wx-webapp-input-unique"" data-value=""abc"">*")]
        public void ValueForm(string value, string expected)
        {
            // arrange
            var initialized = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null);
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
        /// Tests the value method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div class=""wx-webapp-input-unique""></div>*")]
        [InlineData("abc", @"*<div class=""wx-webapp-input-unique"" data-value=""abc"">*")]
        public void ValueItem(string value, string expected)
        {
            // arrange
            var initialized = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique(null)
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
        /// Tests the validate method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box""></div>*")]
        [InlineData("abc", @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box"" data-value=""abc""></div>*")]
        public void ValidateForm(string value, string expected)
        {
            // arrange
            var validated = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique("text-box").Initialize(args =>
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
            context.Request.AddParameter(new Parameter("text-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(validated);
        }

        /// <summary>
        /// Tests the validate method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box""></div>*")]
        [InlineData("abc", @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box"" data-value=""abc""></div>*")]
        public void ValidateItem(string value, string expected)
        {
            // arrange
            var validated = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique("text-box")
                .Validate
                (
                    x =>
                    {
                        x
                        .Add(x.Value is not null, "validation1", TypeInputValidity.Warning)
                        .Add(x.Value?.Text?.Length > 3, "validation2")
                        .Add(false, "validation3");
                        validated = true;
                    }
                );
            var form = new ControlForm()
                .Add(control);

            context.Request.AddParameter(new Parameter(form.Id, context.Request?.Session.Id.ToString(), ParameterScope.Parameter));
            context.Request.AddParameter(new Parameter("text-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(validated);
        }

        /// <summary>
        /// Tests the process method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box""></div>*")]
        [InlineData("abc", @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box"" data-value=""abc""></div>*")]
        public void ProcessForm(string value, string expected)
        {
            // arrange
            var processed = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique("text-box")
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
            context.Request.AddParameter(new Parameter("text-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(processed);
        }

        /// <summary>
        /// Tests the process method of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box""></div>*")]
        [InlineData("abc", @"*<div id=""text-box"" class=""wx-webapp-input-unique"" name=""text-box"" data-value=""abc""></div>*")]
        public void ProcessItem(string value, string expected)
        {
            // arrange
            var processed = false;
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlRestFormItemInputUnique("text-box")
                .Initialize(x => x.Value.Text = value)
                .Process(x => processed = true);
            var form = new ControlForm()
                .Add(control);

            context.Request.AddParameter(new Parameter(form.Id, context.Request?.Session.Id.ToString(), ParameterScope.Parameter));
            context.Request.AddParameter(new Parameter("text-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(processed);
        }
    }
}