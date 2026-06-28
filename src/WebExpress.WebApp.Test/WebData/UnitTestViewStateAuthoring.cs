using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the fluent C# authoring surface for the resources of a scope
    /// ViewState: the <see cref="DataResourceBuilder"/> that produces a resource
    /// descriptor and the Resource extension that lets a scope host declare its
    /// resources by chaining, matching the View, State and Service concept at
    /// scope scope.
    /// </summary>
    public class UnitTestViewStateAuthoring
    {
        /// <summary>
        /// Tests that the builder produces a descriptor that carries the declared
        /// service, target and parameter bindings.
        /// </summary>
        [Fact]
        public void BuilderProducesResourceShape()
        {
            var island = new DataResourceBuilder("orders")
                .Service("data")
                .Target("orders")
                .Param("page", "page", "inout")
                .Param("search", "search", "out")
                .Build()
                .ToIslandElement()
                .ToString();

            Assert.Contains("name=\"orders\"", island);
            Assert.Contains("service=\"data\"", island);
            Assert.Contains("target=\"orders\"", island);
            Assert.Contains("<wx-param name=\"page\" state=\"page\" dir=\"inout\"></wx-param>", island);
            Assert.Contains("<wx-param name=\"search\" state=\"search\" dir=\"out\"></wx-param>", island);
        }

        /// <summary>
        /// Tests that the builder defaults the service to data and the parameter
        /// direction to inout, so the common case needs no repetition.
        /// </summary>
        [Fact]
        public void BuilderDefaultsServiceAndDirection()
        {
            var island = new DataResourceBuilder("orders")
                .Param("page")
                .Build()
                .ToIslandElement()
                .ToString();

            Assert.Contains("service=\"data\"", island);
            Assert.Contains("<wx-param name=\"page\" state=\"page\" dir=\"inout\"></wx-param>", island);
        }

        /// <summary>
        /// Tests that the on demand builder produces a resource that opts out of
        /// the automatic load.
        /// </summary>
        [Fact]
        public void BuilderOnDemandOptsOutOfAutoLoad()
        {
            var island = new DataResourceBuilder("orders")
                .Auto(false)
                .Build()
                .ToIslandElement()
                .ToString();

            Assert.Contains("auto=\"false\"", island);
        }

        /// <summary>
        /// Tests that the fluent Resource extension accumulates one resource
        /// factory per call, so a scope can declare several resources.
        /// </summary>
        [Fact]
        public void FluentResourceAccumulatesFactories()
        {
            var control = new WebExpress.WebApp.WebControl.ControlViewState("orders")
                .Resource("orders", r => r.Service("data").Param("page"))
                .Resource("summary", r => r.Service("data").Auto(false));

            Assert.Equal(2, control.ResourceFactories.Count);
        }
    }
}
