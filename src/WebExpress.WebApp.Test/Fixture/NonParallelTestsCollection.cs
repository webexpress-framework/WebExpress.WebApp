namespace WebExpress.WebApp.Test.Fixture
{
    /// <summary>
    /// Defines a collection of tests that should not be run in parallel.
    /// </summary>
    /// <remarks>
    /// Only tests that cannot share the machine belong here, such as a cluster test that must
    /// finish between two ticks of the system metrics timer every hub starts. Every other test
    /// binds its own hub and runs in parallel.
    /// </remarks>
    [CollectionDefinition("NonParallelTests", DisableParallelization = true)]
    public class NonParallelTestsCollection : ICollectionFixture<UnitTestControlFixture>
    {

    }
}
