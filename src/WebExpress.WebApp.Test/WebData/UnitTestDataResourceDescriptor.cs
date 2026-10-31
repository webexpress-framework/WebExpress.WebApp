using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the C# resource descriptor that renders into the wx-resource island
    /// element. The island is consumed by webexpress.webapp.ViewState, so the test
    /// pins the shape that the ViewState loads its central resources from, including
    /// the bidirectional parameter bindings.
    /// </summary>
    public class UnitTestDataResourceDescriptor
    {
        /// <summary>
        /// Tests that a resource renders its name, service and target as
        /// attributes and its parameters as wx-param children with their binding
        /// direction.
        /// </summary>
        [Fact]
        public void RendersResourceShape()
        {
            var island = DataResourceDescriptor.Create("orders")
                .WithService("data")
                .WithTarget("orders")
                .MapParam("page", "page", "inout")
                .MapParam("search", "search", "out")
                .ToIslandElement()
                .ToString();

            Assert.StartsWith("<wx-resource hidden", island.TrimStart());
            Assert.Contains("name=\"orders\"", island);
            Assert.Contains("service=\"data\"", island);
            Assert.Contains("target=\"orders\"", island);
            Assert.Contains("<wx-param name=\"page\" state=\"page\" dir=\"inout\"></wx-param>", island);
            Assert.Contains("<wx-param name=\"search\" state=\"search\" dir=\"out\"></wx-param>", island);
        }

        /// <summary>
        /// Tests that an automatic resource omits the auto attribute, mirroring
        /// the client default that a resource loads automatically unless told
        /// otherwise.
        /// </summary>
        [Fact]
        public void AutomaticResourceOmitsTheAutoAttribute()
        {
            var island = DataResourceDescriptor.Create("orders").ToIslandElement().ToString();

            Assert.DoesNotContain("auto=", island);
        }

        /// <summary>
        /// Tests that a resource that loads on demand emits auto="false", which
        /// the client reads to skip the load on mount.
        /// </summary>
        [Fact]
        public void OnDemandResourceEmitsAutoFalse()
        {
            var island = DataResourceDescriptor.Create("orders").WithAuto(false).ToIslandElement().ToString();

            Assert.Contains("auto=\"false\"", island);
        }

        /// <summary>
        /// Tests that the target defaults to the resource name and a parameter
        /// state defaults to the parameter name and the direction to inout, so the
        /// common case needs no repetition.
        /// </summary>
        [Fact]
        public void DefaultsTargetStateAndDirection()
        {
            var island = DataResourceDescriptor.Create("orders").MapParam("page").ToIslandElement().ToString();

            Assert.Contains("target=\"orders\"", island);
            Assert.Contains("<wx-param name=\"page\" state=\"page\" dir=\"inout\"></wx-param>", island);
        }
    }
}
