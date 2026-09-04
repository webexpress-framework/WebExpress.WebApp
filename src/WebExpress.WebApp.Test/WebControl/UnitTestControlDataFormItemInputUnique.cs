using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebData;
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
    public class UnitTestControlDataFormItemInputUnique
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
            var control = new ControlDataFormItemInputUnique(id)
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
            var control = new ControlDataFormItemInputUnique()
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
            var control = new ControlDataFormItemInputUnique(null)
            {
                Name = _ => name
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
            var control = new ControlDataFormItemInputUnique(null)
            {
                Description = _ => description
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
            var control = new ControlDataFormItemInputUnique(null)
            {
                Placeholder = _ => placeholder
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
            var control = new ControlDataFormItemInputUnique(null)
            {
                MinLength = _ => minLength
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
        [InlineData(0u, @"<div class=""wx-webapp-input-unique"" data-maxlength=""0""></div>")]
        [InlineData(10u, @"<div class=""wx-webapp-input-unique"" data-maxlength=""10""></div>")]
        public void MaxLength(uint? maxLength, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique(null)
            {
                MaxLength = _ => maxLength
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
        [InlineData(true, @"<div class=""wx-webapp-input-unique"" data-required=""true""></div>")]
        public void Required(bool required, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique(null)
            {
                Required = _ => required
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
        [InlineData("abc.*", @"<div class=""wx-webapp-input-unique"" data-pattern=""abc.*""></div>")]
        public void Pattern(string pattern, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique(null)
            {
                Pattern = _ => pattern
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
        [InlineData("https://example.com/api/data", @"<div class=""wx-webapp-input-unique""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/data"" method=""GET""></wx-service></div>")]
        public void Service(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique(null)
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.QueryData(uriString) : null
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
            var control = new ControlDataFormItemInputUnique(null);
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
            var control = new ControlDataFormItemInputUnique(null)
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
            var context = UnitTestControlFixture.CreateRenderContextMock
            (
                null,
                null,
                new Parameter("form", "", ParameterScope.Parameter)
            );
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique("text-box").Initialize(args =>
            {
                args.Value.Text = value;
            });
            var form = new ControlForm() { Name = _ => "form" }
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
            var context = UnitTestControlFixture.CreateRenderContextMock
            (
                null,
                null,
                new Parameter("form", "", ParameterScope.Parameter)
            );
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique("text-box")
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
            var form = new ControlForm() { Name = _ => "form" }
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
            var context = UnitTestControlFixture.CreateRenderContextMock
            (
                null,
                null,
                new Parameter("form", "", ParameterScope.Parameter)
            );
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique("text-box")
                .Initialize(args =>
                {
                    args.Value.Text = value;
                });
            var form = new ControlForm() { Name = _ => "form" }
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
            var context = UnitTestControlFixture.CreateRenderContextMock
            (
                null,
                null,
                new Parameter("form", "", ParameterScope.Parameter)
            );
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataFormItemInputUnique("text-box")
                .Initialize(x => x.Value.Text = value)
                .Process(x => processed = true);
            var form = new ControlForm() { Name = _ => "form" }
                .Add(control);

            context.Request.AddParameter(new Parameter(form.Id, context.Request?.Session.Id.ToString(), ParameterScope.Parameter));
            context.Request.AddParameter(new Parameter("text-box", value, ParameterScope.Parameter));

            // act
            var html = form.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
            Assert.True(processed);
        }

        /// <summary>
        /// Tests the server side min length check of the REST unique control. The browser
        /// is not the only way in, so a value that never passed the native constraint has
        /// to be caught here.
        /// </summary>
        [Theory]
        [InlineData(null, false)]
        [InlineData("ab", true)]
        [InlineData("abc", false)]
        [InlineData("abcd", false)]
        public void ValidateMinLength(string value, bool expectedError)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var control = new ControlDataFormItemInputUnique("text-box")
            {
                MinLength = _ => 3u
            };

            if (value is not null)
            {
                context.SetValue(control, new ControlFormInputValueString(value));
            }

            // act
            var results = control.Validate(context).ToList();

            // validation
            Assert.Equal(expectedError, results.Any(x => x.Type == TypeInputValidity.Error));
            Assert.DoesNotContain(results, x => x.Text.Contains("System.Func"));
        }

        /// <summary>
        /// Tests the server side max length check of the REST unique control.
        /// </summary>
        [Theory]
        [InlineData(null, false)]
        [InlineData("abc", false)]
        [InlineData("abcd", false)]
        [InlineData("abcde", true)]
        public void ValidateMaxLength(string value, bool expectedError)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var form = new ControlForm();
            var context = new RenderControlFormContext(UnitTestControlFixture.CreateRenderContextMock(), form);
            var control = new ControlDataFormItemInputUnique("text-box")
            {
                MaxLength = _ => 4u
            };

            if (value is not null)
            {
                context.SetValue(control, new ControlFormInputValueString(value));
            }

            // act
            var results = control.Validate(context).ToList();

            // validation
            Assert.Equal(expectedError, results.Any(x => x.Type == TypeInputValidity.Error));
            Assert.DoesNotContain(results, x => x.Text.Contains("System.Func"));
        }
    }
}