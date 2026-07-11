using WebExpress.WebApp.Test.Fixture;
using WebExpress.WebApp.WebControl;
using WebExpress.WebApp.WebData;
using WebExpress.WebUI.WebControl;
using WebExpress.WebUI.WebPage;

namespace WebExpress.WebApp.Test.WebControl
{
    /// <summary>
    /// Tests the REST-backed traffic light control. The control only emits the
    /// host element and its data islands; the actual rendering happens in the JS
    /// controller <c>webexpress.webapp.TrafficLightCtrl</c>.
    /// </summary>
    [Collection("NonParallelTests")]
    public class UnitTestControlDataTrafficLight
    {
        /// <summary>
        /// Tests the id property of the traffic light control.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData("id", @"<div id=""id"" class=""wx-webapp-traffic-light""></div>")]
        public void Id(string id, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight(id)
            {
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the data service is emitted as a wx-service island carrying
        /// the load and the update method.
        /// </summary>
        [Theory]
        [InlineData(null, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData("https://example.com/api/status/INC-1", @"<div class=""wx-webapp-traffic-light""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/status/INC-1"" method=""GET"" update-method=""PUT""></wx-service></div>")]
        public void RestUri(string uriString, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                ServiceFactory = uriString is not null ? _ => DataServiceDescriptor.Data(uriString) : null
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the seeded state renders into the <c>data-value</c>
        /// attribute, with the off default implied.
        /// </summary>
        [Theory]
        [InlineData(TypeTrafficLight.Off, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData(TypeTrafficLight.Red, @"<div class=""wx-webapp-traffic-light"" data-value=""red""></div>")]
        [InlineData(TypeTrafficLight.Yellow, @"<div class=""wx-webapp-traffic-light"" data-value=""yellow""></div>")]
        [InlineData(TypeTrafficLight.Green, @"<div class=""wx-webapp-traffic-light"" data-value=""green""></div>")]
        public void Value(TypeTrafficLight value, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                Value = _ => value
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the orientation property. The vertical default is implied and
        /// therefore not emitted.
        /// </summary>
        [Theory]
        [InlineData(TypeOrientationTrafficLight.Vertical, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData(TypeOrientationTrafficLight.Horizontal, @"<div class=""wx-webapp-traffic-light"" data-orientation=""horizontal""></div>")]
        public void Orientation(TypeOrientationTrafficLight orientation, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                Orientation = _ => orientation
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests the size property. The compact default is implied and therefore
        /// emits no modifier class.
        /// </summary>
        [Theory]
        [InlineData(TypeSizeTrafficLight.Default, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData(TypeSizeTrafficLight.Small, @"<div class=""wx-webapp-traffic-light wx-traffic-light-sm""></div>")]
        [InlineData(TypeSizeTrafficLight.ExtraLarge, @"<div class=""wx-webapp-traffic-light wx-traffic-light-xl""></div>")]
        public void Size(TypeSizeTrafficLight size, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                Size = _ => size
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests that the Readonly flag suppresses or emits the
        /// <c>data-readonly</c> attribute.
        /// </summary>
        [Theory]
        [InlineData(false, @"<div class=""wx-webapp-traffic-light""></div>")]
        [InlineData(true, @"<div class=""wx-webapp-traffic-light"" data-readonly=""true""></div>")]
        public void Readonly(bool readOnly, string expected)
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                Readonly = _ => readOnly
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(expected, html);
        }

        /// <summary>
        /// Tests every data attribute rendering together.
        /// </summary>
        [Fact]
        public void AllAttributes()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight("t1")
            {
                ServiceFactory = _ => DataServiceDescriptor.Data("https://example.com/api/status/INC-1"),
                Value = _ => TypeTrafficLight.Green,
                Orientation = _ => TypeOrientationTrafficLight.Horizontal,
                Readonly = _ => true
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div id=""t1"" class=""wx-webapp-traffic-light"" data-value=""green"" data-orientation=""horizontal"" data-readonly=""true""><wx-service hidden name=""data"" kind=""rest"" base-uri=""https://example.com/api/status/INC-1"" method=""GET"" update-method=""PUT""></wx-service></div>", html);
        }

        /// <summary>
        /// When bound to a ViewState resource, the control emits only the
        /// <c>data-wx-resource</c> binding and skips its own <c>wx-service</c>
        /// island, because the enclosing ViewState owns the service and the central load.
        /// </summary>
        [Fact]
        public void ViewStateBound_EmitsResourceBinding_NotService()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                // even with a service declared, the resource binding wins
                ServiceFactory = _ => DataServiceDescriptor.Data("https://example.com/api/status/INC-1"),
                ResourceFactory = _ => "status"
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            AssertExtensions.EqualWithPlaceholders(@"<div class=""wx-webapp-traffic-light"" data-wx-resource=""status""></div>", html);
        }

        /// <summary>
        /// Disabled controls must render to <c>null</c> so the page does not
        /// contain an inert traffic light host.
        /// </summary>
        [Fact]
        public void Enable_False_RendersNothing()
        {
            // arrange
            var componentHub = UnitTestControlFixture.CreateAndRegisterComponentHubMock();
            var context = UnitTestControlFixture.CreateRenderContextMock();
            var visualTree = new VisualTreeControl(componentHub, context.PageContext);
            var control = new ControlDataTrafficLight()
            {
                Enable = _ => false
            };

            // act
            var html = control.Render(context, visualTree);

            // validation
            Assert.Null(html);
        }

        /// <summary>
        /// The fluent <c>Resource&lt;TResource&gt;()</c> binding sets the resource factory to the
        /// resource type name and preserves the concrete control type for chaining.
        /// </summary>
        [Fact]
        public void Resource_BindsByType_PreservingConcreteType()
        {
            // arrange & act: the assignment compiles only because the typed overload returns the
            // concrete control type rather than IViewStateBound
            ControlDataTrafficLight control = new ControlDataTrafficLight("status").Resource<StatusTestResource>();

            // validation
            Assert.Equal(DataTypeName.Of<StatusTestResource>(), control.ResourceFactory(null));
        }

        /// <summary>
        /// A resource identity used only by the binding test.
        /// </summary>
        private sealed class StatusTestResource : IDataResource
        {
        }
    }
}
