namespace WebExpress.WebApp.WebData
{
    /// <summary>
    /// Marks a type as the identity of a ViewState resource. A resource type names a
    /// central resource of a ViewState in a type-safe way, replacing the
    /// string resource name: the ViewState declares the resource with
    /// Resource&lt;TResource&gt;() and a control binds to it with
    /// Resource&lt;TResource&gt;(), so no resource name is spelled as a string at
    /// the call site. The wire name the islands carry is derived from the type
    /// through <see cref="DataTypeName"/>. See WebExpress/docs/view-state-service.md.
    /// </summary>
    public interface IDataResource
    {
    }
}
