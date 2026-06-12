using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the C# control state that renders into the wx-state island
    /// element. The island is consumed by the engine through
    /// webexpress.webapp.Data.readState, so the test pins the shape that the
    /// component seeds its store from.
    /// </summary>
    public class UnitTestDataState
    {
        /// <summary>
        /// Tests that keys render in insertion order and numbers carry their
        /// type marker so the client restores them losslessly.
        /// </summary>
        [Fact]
        public void SetRendersValuesByType()
        {
            var island = DataState.Create().Set("page", 0).Set("pageSize", 50).ToIslandElement().ToString();

            Assert.StartsWith("<wx-state hidden>", island.TrimStart());
            Assert.Contains("<wx-prop name=\"page\" type=\"number\">0</wx-prop>", island);
            Assert.Contains("<wx-prop name=\"pageSize\" type=\"number\">50</wx-prop>", island);
            Assert.True(island.IndexOf("\"page\"") < island.IndexOf("\"pageSize\""));
        }

        /// <summary>
        /// Tests that strings, booleans and arrays are supported as state
        /// values: strings carry no marker, booleans and structured values
        /// carry theirs.
        /// </summary>
        [Fact]
        public void SupportsStringsBooleansAndArrays()
        {
            var island = DataState.Create()
                .Set("search", "treasure")
                .Set("loading", false)
                .Set("items", new[] { "a", "b" })
                .ToIslandElement()
                .ToString();

            Assert.Contains("<wx-prop name=\"search\">treasure</wx-prop>", island);
            Assert.Contains("<wx-prop name=\"loading\" type=\"boolean\">false</wx-prop>", island);
            Assert.Contains("<wx-prop name=\"items\" type=\"json\">[&quot;a&quot;,&quot;b&quot;]</wx-prop>", island);
        }

        /// <summary>
        /// Tests that an empty state reports empty, so the control can omit the
        /// island.
        /// </summary>
        [Fact]
        public void EmptyStateIsEmpty()
        {
            var state = DataState.Create();

            Assert.True(state.IsEmpty);
        }

        /// <summary>
        /// Tests that a later set for the same key replaces the earlier value.
        /// </summary>
        [Fact]
        public void LaterSetReplacesEarlierValue()
        {
            var island = DataState.Create().Set("page", 0).Set("page", 3).ToIslandElement().ToString();

            Assert.Contains("<wx-prop name=\"page\" type=\"number\">3</wx-prop>", island);
            Assert.DoesNotContain(">0</wx-prop>", island);
        }
    }
}
