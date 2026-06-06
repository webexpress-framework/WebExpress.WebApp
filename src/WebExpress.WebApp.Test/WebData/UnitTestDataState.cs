using WebExpress.WebApp.WebData;

namespace WebExpress.WebApp.Test.WebData
{
    /// <summary>
    /// Tests the C# control state that serializes into the data-wx-state island.
    /// The island is consumed by the engine through
    /// webexpress.webapp.Data.readState, so the test pins the shape that the
    /// component seeds its store from.
    /// </summary>
    public class UnitTestDataState
    {
        /// <summary>
        /// Tests that keys and numeric values serialize in insertion order.
        /// </summary>
        [Fact]
        public void SetSerializesValuesByType()
        {
            var json = DataState.Create().Set("page", 0).Set("pageSize", 50).ToIsland();

            Assert.Equal("{\"page\":0,\"pageSize\":50}", json);
        }

        /// <summary>
        /// Tests that strings, booleans and arrays are supported as state values.
        /// </summary>
        [Fact]
        public void SupportsStringsBooleansAndArrays()
        {
            var json = DataState.Create()
                .Set("search", "")
                .Set("loading", false)
                .Set("items", new[] { "a", "b" })
                .ToIsland();

            Assert.Equal("{\"search\":\"\",\"loading\":false,\"items\":[\"a\",\"b\"]}", json);
        }

        /// <summary>
        /// Tests that an empty state reports empty and serializes to an empty
        /// object, so the control can omit the island.
        /// </summary>
        [Fact]
        public void EmptyStateIsEmptyAndSerializesToAnEmptyObject()
        {
            var state = DataState.Create();

            Assert.True(state.IsEmpty);
            Assert.Equal("{}", state.ToIsland());
        }

        /// <summary>
        /// Tests that a later set for the same key replaces the earlier value.
        /// </summary>
        [Fact]
        public void LaterSetReplacesEarlierValue()
        {
            var json = DataState.Create().Set("page", 0).Set("page", 3).ToIsland();

            Assert.Equal("{\"page\":3}", json);
        }
    }
}
